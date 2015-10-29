var cheerio = require('cheerio')
var Q = require('q');
var http = require('follow-redirects').http;
Q.map = function map (arr, iterator) {
  // execute the func for each element in the array and collect the results
  var promises = arr.map(function (el) { return iterator(el) })
  return Q.all(promises) // return the group promise
}
Array.prototype.clean = function() {
  for (var i = 0; i < this.length; i++) {
    if (this[i] === undefined) {         
      this.splice(i, 1);
      i--;
    }
  }
  return this;
};

function httpRequest(url) {
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
function getSessions() {
  return httpRequest("http://web.csulb.edu/depts/enrollment/registration/class_schedule/").then(function(value) {
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
          // console.log("links:")
      // console.log(links);
      resolve(links);
    })
  })
}
function getDepartmentsForSessionURL(sessionURL) {
  return httpRequest(sessionURL).then(function(value) {
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
  },function(error) {
    console.log("BAD"+error)
  });
}

function getCoursesForDepartmentURL(departmentURL) {
    return httpRequest(departmentURL).then(function(value) {
    var deferred = Q.defer();
    var $ = cheerio.load(value.toString());
    var courses = $(".courseBlock");
   // console.log(courses)
    deferred.resolve(courses.map(function(i) {
      var code = $(courses[i]).find(".courseCode").text();
      var title = $(courses[i]).find(".courseTitle").text();
      var units = $(courses[i]).find(".units").text().split(" ")[0];
      var sectionTable = $(courses[i]).find(".sectionTable tr");
      var sections = sectionTable.map(function(j) {
        if(j===0) return undefined;
        var sectionNumber = $(sectionTable[j]).find("td").eq(0).text()
        var classNumber = $(sectionTable[j]).find("td").eq(1).text()
        var type = $(sectionTable[j]).find("td").eq(3).text()
        var days = $(sectionTable[j]).find("td").eq(4).text()
        var time = $(sectionTable[j]).find("td").eq(5).text()
        var open = $(sectionTable[j]).find(".dot").length > 0;
        var location = $(sectionTable[j]).find("td").eq(7).text()
        var instructor = $(sectionTable[j]).find("td").eq(8).text()
        return {
          "sectionNumber" : sectionNumber,
          "classNumber" : classNumber,
          "type" : type,
          "days" : days,
          "time" : time,
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
  },function(error) {
    console.log("BAD"+error)
  });
}

getSessions()
  /*.then(function(sessions) {
    console.log(sessions);
    console.log("...")
    var mapped =  Q.map(sessions, getDepartments);
    return mapped;
  })*/
  .then(function(sessions) {
    return getDepartmentsForSessionURL(sessions[0].url)
  })
  .then(function(departments) {
    return getCoursesForDepartmentURL(departments[0].url)
  })
  .then(function(courses) {
    console.log(courses[0])
  })

