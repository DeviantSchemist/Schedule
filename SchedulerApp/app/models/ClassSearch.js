// import requirements
var cheerio = require('cheerio');
var Q = require('q');
var http = require('follow-redirects').http;
require("console.table")



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
        var image = $(link).find("img");
        var iconLink = image.attr("src");

        return new Session({ 
          "name" : link.text().trim(),
          "url"  : link.attr("href"),
          "icon" : "http://web.csulb.edu/depts/enrollment/registration/class_schedule/"+iconLink
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
  this.icon = data.icon;
}

Session.prototype.getDepartments = function(force) {
  var session = this;
  if(this.departments && !force) {
    return new Q.promise(function(resolve) {resolve(session.departments)});
  }

  return getDepartmentsForSessionURL(this.url).then(function(result) {
    session.departments = result;
    return session.departments;
  });
}
Session.prototype.getAllCourses = function(force) {
  var session = this;
  var allCourses = [];
  return this.getDepartments(force).then(function(departments) {
    return Q.map(departments, function(department) {
      return department.getCourses(force).then(function(courses) {
        allCourses.push.apply(allCourses, courses);
        return courses;
      })
    }).then(function() {
      return allCourses;
    })
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
    var dept = this;


  if(this.courses && !force) {
    return new Q.promise(function(resolve) {resolve(dept.courses)});

  }
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
  this.daysOfWeek = [];
  var days = data.days.split(/(?=[A-Z])/);
  var hasValidDOW = days.length > 0;
  for(var i = 0; i < days.length; i++) {
    switch(days[i]) {
      case "M":  this.daysOfWeek.push("Monday");    break;
      case "Tu": this.daysOfWeek.push("Tuesday");   break;
      case "W":  this.daysOfWeek.push("Wednesday"); break;
      case "Th": this.daysOfWeek.push("Thursday");  break;
      case "F":  this.daysOfWeek.push("Friday");    break;
      case "Sa": this.daysOfWeek.push("Saturday");  break;
      case "Su": this.daysOfWeek.push("Sunday");    break;
      default:   hasValidDOW = false;               break; // catch other strings...
    }
  }
  if(!hasValidDOW) {
    this.daysOfWeek = ["Unknown"];
  }
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
    if(endTimeString.indexOf("PM") == endTimeString.length-2) {
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
Section.prototype.getDaysOfWeek = function() {

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

      console.assert(time%(60*12) == backToTime,"Time conversion failed for "+time+" != "+backToTime);
      console.assert(isPM == (time>=noon), "AM/PM mismatch")
    }
}
var session;
  getSessions()
    .then(function(sessions) {
      session = sessions[0];
      return sessions[0].getDepartments();
    })
    .then(function(departments) {
      return departments[0].getCourses();
    })
    .then(function(courses) {
      //console.log(JSON.stringify(session, null, "  "))
      for(var i = 0; i < 100000; i++) {
        session.getDepartments() // make sure cache works
      }
      // console.log("course has "+courses[0].getNumberOfSections()+" sections.")
      console.log(courses[0])
    })
  // var allSessions;
  // getSessions().then(function(sessions) {
  //   allSessions = sessions;
  //   return sessions[0].getAllCourses();
  // }).then(function(result) {
  //   var startTime = new Date();
  //   for(var i = 0; i < 100; i++) {
  //     (function(i) {
  //       allSessions[0].getAllCourses().then(function() {
  //         console.log(i);
  //       });
  //     })(i);
  //   }
  //   assert((new Date() - startTime)/1000 < 1, "Data is no longer cached :(");

  // });

}


module.exports = {
  httpRead: httpRead,
  getSessions: getSessions,
  getDepartmentsForSessionURL:getDepartmentsForSessionURL,
  getCoursesForDepartmentURL:getCoursesForDepartmentURL
};
