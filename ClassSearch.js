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

function timeStringToMinutes(timeString) {
  var parts = timeString.split(":");
  var hours = parseInt(parts[0]);
  if(hours === 12) {
    hours = 0;
  }
  var minutes = parseInt(parts[1] || "0");
  return (hours * 60) + minutes;
}
function minutesToTimeString(minutes) {
  if(minutes === undefined) {
    return "N/A";
  }
  var min = minutes % 60;
  var hour24 = Math.floor(minutes / 60);
  var hour = hour24 % 12;
  var suffix = hour24 >= 12 ? "pm" : "am";
  if(hour === 0) {
    hour = 12;
  }
  return hour+":"+((min < 10 ? "0" : "")+min)+suffix;
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
        if(j === 0) {
          // first row is header information.
          return undefined; 
        }
        var sectionNumber = $(sectionTable[j]).find("th").eq(0).text()
        var classNumber = $(sectionTable[j]).find("td").eq(0).text()
        var type =  $(sectionTable[j]).find("td").eq(2).text()
        var days = $(sectionTable[j]).find("td").eq(3).text()
        var timeRange = $(sectionTable[j]).find("td").eq(4).text()
        var open = $(sectionTable[j]).find(".dot").length > 0;
        var location = $(sectionTable[j]).find("td").eq(6).text()
        var instructor = $(sectionTable[j]).find("td").eq(7).text()
        return new Section({
          "sectionNumber" : sectionNumber,
          "classNumber" : classNumber,
          "type" : type,
          "days" : days,
          "timeRange": timeRange,
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




function Session(data) {
  this.name = data.name;
  this.url = data.url;
  /*
  for(var key in data) {
    if(data.hasOwnProperty(key)) {
      this[key] = data[key];
    }
  }*/
}

Session.prototype.getDepartments = function(force) {
  if(this.departments && !force) {
    return this.departments;
  }
  var session = this;

  return getDepartmentsForSessionURL(this.url).then(function(result) {
    session.departments = result;
    return session.departments;
  });
}



function Department(data) {
  this.name = data.name;
  this.url = data.url;
/*  for(var key in data) {
    if(data.hasOwnProperty(key)) {
      this[key] = data[key];
    }
  }*/
}

Department.prototype.getCourses = function(force) {
  if(this.courses && !force) {
    return this.courses;
  }
  var dept = this;
  return getCoursesForDepartmentURL(this.url).then(function(result) {
    dept.courses = result;
    return dept.courses;
  })
}

function Course(data) {
  this.code = data.code;
  this.title = data.title;
  this.units = data.units;
  this.sections = data.sections;
  /*
  for(var key in data) {
    if(data.hasOwnProperty(key)) {
      this[key] = data[key];
    }
  }*/
}
Course.prototype.getNumberOfSections = function() {
  return this.sections.length;
}
function Section(data) {
  this.sectionNumber = data.sectionNumber;
  this.classNumber = data.classNumber;
  this.type = data.type;
  this.days = data.days;
  this.open = data.open;
  this.location = data.location;
  this.instructor = data.instructor;
  this.startTime = data.startTime;
  this.endTime = data.endTime;

  var time = data.timeRange.split("-")
  var startTime = undefined;
  var endTime = undefined;
  if(time.length > 1) {
    // generate time as number 
    var startTimeString = time[0];
    var endTimeString = time[1];
    var endsInPM = false;
    if(endTimeString.endsWith("PM")) {
      endsInPM = true;
    }
    var startsInPM = endsInPM;
    endTimeString = endTimeString.substring(0, endTimeString.length-2).trim();

    var endTime = timeStringToMinutes(endTimeString);
    var startTime = timeStringToMinutes(startTimeString);

    if(startTime > endTime) {
      startsInPM = !startsInPM;
    }
    var pmShift = 12*60;
    if(startsInPM) {
      startTime = startTime + pmShift;
    }
    if(endsInPM) {
      endTime = endTime + pmShift;
    }
  }
  this.startTime = startTime;
  this.endTime = endTime;
}
Section.prototype.getStartTimeString = function() {
  return minutesToTimeString(this.startTime);
}
Section.prototype.getEndTimeString = function() {
  return minutesToTimeString(this.endTime);
}
Course.prototype.matches = function(searchQuery) {
  return false;
}


var session = undefined;
function XOR(a, b) {
    return ( a || b ) && !( a && b );
}
if(!module.parent) {

  // execute code for testing.
  // Test time
  // f
  var noon = (60*12);
  for(var hour = 0; hour < 24; hour++) {
    for(var minute = 0; minute < 60; minute++) {
      var isPM = hour>=12;
      var time = hour*60+minute;
      var timeString = minutesToTimeString(time);
      var backToTime = timeStringToMinutes(timeString);

      if(time%(60*12) != backToTime || XOR(isPM, time>=noon) ) {
        throw "ERROR: time conversion failed for "+time;
      }
    }
}
  getSessions()
    .then(function(sessions) {
      session = sessions[0];
      return sessions[0].getDepartments();
    })
    .then(function(departments) {
      console.log("getting courses")
      return departments[0].getCourses();
    })
    .then(function(courses) {
      console.log(courses[0])
      for(var i = 0; i < 100000; i++) {
        session.getDepartments() // make sure cache works
      }
      console.log("course has "+courses[0].getNumberOfSections()+" sections.")
      console.log(courses[0].sections[9].getEndTimeString())
    })
/*var allSessions = undefined;
getSessions().then(function(sessions) {
  allSessions = sessions;
  return sessions[0].getDepartments();
}).then(function(departments) {
  return Q.map(departments, function(department) {
    console.log("Getting info on department: "+department.name)
    return department.getCourses()
  }).then(function(allDepartments) {
    console.log(JSON.stringify(allSessions));
  })
})*/
}
module.exports = {
  httpRead: httpRead,
  getSessions: getSessions,
  getDepartmentsForSessionURL:getDepartmentsForSessionURL,
  getCoursesForDepartmentURL:getCoursesForDepartmentURL
};
