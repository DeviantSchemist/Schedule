"use strict";

var observableArray = require("data/observable-array");
var navigation = require("../../shared/navigation");
var classSearch = require("../../models/class-search");
var allSessions;

function onPageLoaded(args) {
  var page = args.object;

  classSearch.getSessions().then(function(sessions) {
    var array = new observableArray.ObservableArray();
    sessions.forEach(function(session) {
      array.push(session);
    });
    page.bindingContext = {myItems: array};
    allSessions = array;

  });

  
}
exports.onPageLoaded = onPageLoaded;
exports.onTap = function(args) {
  console.log(args.index);
  navigation.goToDepartmentsForSession(allSessions.getItem(args.index));
};
