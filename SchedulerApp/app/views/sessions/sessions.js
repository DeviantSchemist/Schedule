

var observableArray = require("data/observable-array");
var navigation = require("../../shared/navigation");
var dept = require("../../models/class-search");

function onPageLoaded(args) {
  //classes.getDepartments().then(console.log);
  var page = args.object;
  var array = new observableArray.ObservableArray();

  array.push({title: "Title1", src: 'https://web.csulb.edu/depts/enrollment/assets/img/buttonsSM/images/class_sched_spring_2005.jpg'});
  array.push({title: "Title2", src: 'https://web.csulb.edu/depts/enrollment/assets/img/buttonsSM/images/class_sched_spring_2005.jpg'});

  page.bindingContext = {myItems: array};
}
exports.onPageLoaded = onPageLoaded;
exports.onTap = function(a) {
	navigation.goToSessions()
}
