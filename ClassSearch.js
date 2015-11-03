// import requirements
var cheerio = require('cheerio');
var Q = require('q');
var http = require('follow-redirects').http;



/**
 * @param  {Array}      arr
 * @param  {function}   iterator 
 * @return {Promise}
 */
Q.map = function map (arr, iterator) {
  return Q.all(arr.map(function (el) { return iterator(el) }));
}

// extend array prototype to remove undefined values
Array.prototype.clean = function() {
  for (var i = 0; i < this.length; i++) {
    if (this[i] === undefined) {         
      this.splice(i, 1);
      i--;
    }
  }
  return this;
};


/**
 * Generates a promise to retrieve the contents of a website
 * @param  {String} url
 * @return {Promise}
 */
function httpRead(url) {
  return Q.Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        resolve(body);
      });
    }).on('error', function(e) {
      reject(e);
    }).on('error', function(e) {
      reject(e);
    }); 
  })
}

/**
 * Generates a promise to retrieve all sessions from the CSULB website
 * @return {Promise}
 */
function getSessions() {
  return httpRead("http://web.csulb.edu/depts/enrollment/registration/class_schedule/").then(function(value) {
    return Q.Promise(function (resolve) {
      var $ = cheerio.load(value.toString());
      var terms = $(".term")
      var links = terms.map(function() {
        var link = $(this).find("a");

        return new Session({ 
          "name" : link.text().trim(),
          "url"  : link.attr("href")
        });
      }).get();
      resolve(links);
    })
  })
}


/**
 * Generates a promise to get a list of all departments for a session 
 * from the CSULB website
 * @param  {String}   sessionURL
 * @return {Promise} 
 */
function getDepartmentsForSessionURL(sessionURL) {
  return httpRead(sessionURL).then(function(value) {
    var deferred = Q.defer();
    var $ = cheerio.load(value.toString());
    var urlPart = sessionURL.substring(0, sessionURL.lastIndexOf("/")+1)
    var links = $(".indexList li a");
    deferred.resolve(links.map(function(i) {
      var text = $(links[i]).text()
      var splitter = text.lastIndexOf("(");
      var name = text.substring(0,splitter).trim();
      var code = text.substring(splitter+1).replace(")","");
      return new Department({
        "name" : name,
        "code" : code,
        "url" : urlPart+$(links[i]).attr("href")
      });
    }).get());
    return deferred.promise;
  });
}

function Session(data) {
  for(var key in data) {
    if(data.hasOwnProperty(key)) {
      this[key] = data[key];
    }
  }
}
Session.prototype.getDepartments = function() {
  var session = this;
  return getDepartmentsForSessionURL(this.url).then(function(result) {
    session.courses = result;
    return session.courses;
  });
}



function Department(data) {
  for(var key in data) {
    if(data.hasOwnProperty(key)) {
      this[key] = data[key];
    }
  }
}

Department.prototype.getCourses = function() {
  var dept = this;
  return getCoursesForDepartmentURL(this.url).then(function(result) {
    dept.courses = result;
    return dept.courses;
  })
}

function Course(data) {
  for(var key in data) {
    if(data.hasOwnProperty(key)) {
      this[key] = data[key];
    }
  }
}
Course.prototype.getNumberOfSections = function() {
  return this.sections.length;
}
function Section(data) {
  for(var key in data) {
    if(data.hasOwnProperty(key)) {
      this[key] = data[key];
    }
  }
}
Course.prototype.matches = function(searchQuery) {
  return false;
}



/**
 * Promise to get a list of courses for a department from
 * the CSULB website
 *
 * 
 * @param  {String}   departmentURL
 * @return {Promise}
 */
function getCoursesForDepartmentURL(departmentURL) {
    return httpRead(departmentURL).then(function(value) {
    var deferred = Q.defer();
    var $ = cheerio.load(value.toString());
    var courses = $(".courseBlock");
    deferred.resolve(courses.map(function(i) {
      var code = $(courses[i]).find(".courseCode").text();
      var title = $(courses[i]).find(".courseTitle").text();
      var units = $(courses[i]).find(".units").text().split(" ")[0];
      var sectionTable = $(courses[i]).find(".sectionTable tr");
      var sections = sectionTable.map(function(j) {
        if(j === 0) return undefined;
        var sectionNumber = $(sectionTable[j]).find("th").eq(0).text()
        var classNumber = $(sectionTable[j]).find("td").eq(0).text()
        var type =  $(sectionTable[j]).find("td").eq(2).text()
        var days = $(sectionTable[j]).find("td").eq(3).text()
        var time = $(sectionTable[j]).find("td").eq(4).text().split("-")
        var startTime = time[0];
        var endTime = time[1];
        var open = $(sectionTable[j]).find(".dot").length > 0;
        var location = $(sectionTable[j]).find("td").eq(6).text()
        var instructor = $(sectionTable[j]).find("td").eq(7).text()

        return new Section({
          "sectionNumber" : sectionNumber,
          "classNumber" : classNumber,
          "type" : type,
          "days" : days,
          "startTime" : startTime, //TODO: Convert this to a 24 hour date instead of string
          "endTime" : endTime, // with no concept of am/pm in the start time :(
          "open" : open,
          "location" : location,
          "instructor" : instructor
        });
      }).get().clean(); // end of map
      return new Course({
        "code"  : code,
        "title" : title,
        "units" : units,
        "sections" : sections
      });

    }).get());
    return deferred.promise;
  });
}

function doSomething(arguments, callback) {
  callback(answer);
}

var session = undefined;
if(!module.parent) {
  // execute code for testing.
  getSessions()
    .then(function(sessions) {
      session = sessions[0];
      return sessions[0].getDepartments();
    })
    .then(function(departments) {
      return departments[0].getCourses();
    })
    .then(function(courses) {
      console.log(courses[0])
      console.log("course has "+courses[0].getNumberOfSections()+" sections.")
      console.log(session);
    })
}
module.exports = {
  httpRead: httpRead,
  getSessions: getSessions,
  getDepartmentsForSessionURL:getDepartmentsForSessionURL,
  getCoursesForDepartmentURL:getCoursesForDepartmentURL
};
