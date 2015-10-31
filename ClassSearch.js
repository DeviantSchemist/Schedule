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
       // console.log("resolved");
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
      //console.log(terms);
      //console.log("^terms")
      var links = terms.map(function() {
        var link = $(this).find("a");

        return { 
          "name" : link.text().trim(),
          "url"  : link.attr("href")
        };
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
      return {
        "name" : name,
        "code" : code,
        "url" : urlPart+$(links[i]).attr("href")
      };
    }).get());
    return deferred.promise;
  });
}

// Promise to get a list of all courses in a department


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
        return {
          "sectionNumber" : sectionNumber,
          "classNumber" : classNumber,
          "type" : type,
          "days" : days,
          "startTime" : startTime, //TODO: Convert this to a 24 hour date instead of string
          "endTime" : endTime, // with no concept of am/pm in the start time :(
          "open" : open,
          "location" : location,
          "instructor" : instructor
        }
      }).get().clean();
      return {
        "code"  : code,
        "title" : title,
        "units" : units,
        "sections" : sections
      };

    }).get());
    return deferred.promise;
  });
}

function doSomething(arguments, callback) {
  callback(answer);
}


if(!module.parent) {
  // execute code for testing.
  getSessions()
    .then(function(sessions) {
     // console.log(sessions[0])
      return getDepartmentsForSessionURL(sessions[0].url)
    })
    .then(function(departments) {
    //  console.log(departments[0])
      return getCoursesForDepartmentURL(departments[0].url)
    })
    .then(function(courses) {
      console.log(courses[0])
    })
}
module.exports = {
  httpRead: httpRead,
  getSessions: getSessions,
  getDepartmentsForSessionURL:getDepartmentsForSessionURL,
  getCoursesForDepartmentURL:getCoursesForDepartmentURL
};
