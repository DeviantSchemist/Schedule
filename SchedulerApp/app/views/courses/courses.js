"use strict";
var colorModule = require("color");

var observableArray = require("data/observable-array");
var navigation = require("../../shared/navigation");
var dialogs = require("ui/dialogs");

var courses;
var session;

var rmp = require("../../models/ratemyprofessor");
function onPageLoaded(args) {
  console.log("courses loaded.");
  var page = args.object;
  var context = args.object.navigationContext;
  console.log(".");
  for(var n in context) {
    console.log(n);
  }
  var coursesArr = context.courses;
  var title = context.title;
  session = context.session;
  courses = new observableArray.ObservableArray();

  coursesArr.forEach(function(course) {
     course.sections.forEach(function(section) {
      section.getRating = getRating(section.instructor);
     });
     courses.push(course);
  });
  page.bindingContext = {title: context.title, myItems: courses};

};

exports.onPageLoaded = onPageLoaded;
function getRating(professorName) {
  return function(event) {
    console.log("get rating!");
    var target = event.object;
    for(var i in target) {
      console.log("---"+i+": "+target[i]);
    }
    
    console.log("get rating");
    var instructorParts = professorName.split(" ");
    var lastName = instructorParts[0];
    var firstNameInitial = instructorParts[1];
    
    rmp.getProfessor(firstNameInitial, lastName).then(function(professor) {
      if(professor && professor.rating) {
      //dialogs.alert("Rating: "+professor.rating).then(console.log);
      if(target.text) {
        target.text = professor.rating;
      }
      if(target.style) {
        if(parseFloat(professor.rating) < 3) {
          console.log("bad rating");
          target.style.backgroundColor = new colorModule.Color("Red");
        } else {
          target.style.backgroundColor = new colorModule.Color("Green");
        }

      }
      } else {
       dialogs.alert("Cannot find teacher named "+professorName).then(console.log);
       target.style.backgroundColor = new colorModule.Color("Black");
       target.text = "X";

      }
    }, function() {
       dialogs.alert("Error finding "+professorName).then(console.log);
    });
  }
};
exports.onTap = function(a) {
  // console.log(a);
  //navigation.goToDepartmentsForSession(allSessions[0]);
};
exports.navigatedTo =  function(eventData) {
     var context = eventData.object.navigationContext;
};
