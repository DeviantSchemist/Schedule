// // import requirements
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
var httpRead;
if(!http) {
  httpRead = fetch;
} else {
  /**
   * Generates a promise to retrieve the contents of a website
   * @param  {String} url
   * @return {Promise}
   */
  var httpRead = function(url) {
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
}

/**
 * Generates a promise to retrieve all sessions from the CSULB website
 * @return {Promise}
 */
function getSessions() {
  return httpRead("http://web.csulb.edu/depts/enrollment/registration/class_schedule/").then(function(value) {
    return Q.Promise(function (resolve) {
      var terms = value.toString().match(/\<div class\=\"term\"[\s\S]*?\<\/div\>/igm);

      var links = terms.map(function(term,index) {
        var linkString = term.match(/\<a href\=\"(.*?)\">/igm)[0];
        var link = linkString.substring(9,linkString.length-2)
        var imageString = term.match(/\<img\s{0,}src\=\"(.*?)\"/igm)[0];

        var iconLink = imageString.substring(imageString.indexOf("\""), imageString.length-1)
        var name = term.match(/\<span\>[\s\S]*?\<\/span\>/igm)[0]

        name = name.replace(/<[^>]*>/igm, "").trim()
        return new Session({ 
          "name" : name,
          "url"  : link,
          "icon" : "http://web.csulb.edu/depts/enrollment/registration/class_schedule/"+iconLink
        });
      });
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
  var urlPart = sessionURL.substring(0, sessionURL.lastIndexOf("/")+1)
  return httpRead(sessionURL).then(function(value) {
    var deferred = Q.defer();
    var linksSection = value.toString().match(/\<div class=\"indexlist\"\>[\s\S]*?\<!-- end/igm)
    if(linksSection && linksSection[0]) {
      deferred.resolve(linksSection[0].match(/<a href\=\"[\s\S]*?\<\/a>/igm).map(function(link, index) {
        var text = link.substring(link.indexOf(">")+1, link.lastIndexOf("<"));
        var splitter = text.lastIndexOf("(");
        var name = text.substring(0,splitter).trim();
        var code = text.substring(splitter+1).replace(")","");
        var linkString = link.match(/\<a href\=\"(.*?)\">/igm)[0];
        var url = linkString.substring(9,linkString.length-2)
        return new Department({
          "name" : name,
          "code" : code,
          "url" : urlPart+url
        });
      }));
    } else {
      deferred.resolve([]);
    }
    return deferred.promise
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
    var courseBlocks = value.toString().match(/\<div class=\"courseBlock\"\>[\s\S]*?\<!-- end CourseBlock/igm)

    deferred.resolve(courseBlocks.map(function(courseBlock, index) {

      var codeString = courseBlock.match(/<span class\=\"courseCode\">[\s\S]*?<\/span>/igm)[0];
      var code = codeString.substring(codeString.indexOf(">")+1,codeString.lastIndexOf("<"));
      var titleString = courseBlock.match(/<span class\=\"courseTitle\">[\s\S]*?<\/span>/igm)[0];
      var title = titleString.substring(titleString.indexOf(">")+1,titleString.lastIndexOf("<"));
      var unitsString = courseBlock.match(/<span class\=\"units\">[\s\S]*?<\/span>/igm)[0];
      var units = unitsString.substring(unitsString.indexOf(">")+1,unitsString.lastIndexOf("<"));
            var courseRows = courseBlock.match(/<tr>[\s\S]*?<\/tr>/igm).slice(1);
      //console.log(courseRows)
      var sections = courseRows.map(function(row){ 
        var pieces = row.match(/<(td|th)[\s\S]*?>[\s\S]*?<\/(td|th)>/igm) || [];
        var cells = pieces.map(function(val) {
          if(!val) return undefined
          return val.substring(val.indexOf(">")+1, val.lastIndexOf("<"));
        });
        //console.log(cells);
        var sectionNumber = cells[0];
        var classNumber = cells[1];
        var type = cells[3];
        var days = cells[4];
        var timeRange = cells[5];
        var open = /greendot/.test(cells[6]);
        var location = cells[7];
        var instructor = cells[8];
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
      });
      return new Course({
        "code"  : code,
        "title" : title,
        "units" : units,
        "sections" : sections
      });

    }))
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
      console.log(courses)
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
