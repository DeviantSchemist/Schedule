var Observable = require("data/observable");
var ObservableArray = require("data/observable-array");



var cart = [];  //cart array that the course objects are held in

function addToCart(course) {  //possibly done with this?
    if (cart === undefined || cart.length == 0) {
        cart.push(course);
    }
    else {
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].name === course.name) {  // pre-condition: course contains section number
                //if (cart[i].sectionArray === undefined || cart[i].sectionNumbe)
                cart[i].sectionArray.push(course.sectionNumber);
            }
            else {
                cart.push(course);
            }
        }
    }
}


function removeFromCart(args) {  //just a test method to see if remove button works, it works when I added "exports.removeFromCart = removeFromCart"
    viewModel.items.splice(0, 1);
}
exports.removeFromCart = removeFromCart;    

function course(name, sectionNumber, classNumber, type, days, startTime, endTime, open, location, prof) { //for testing purposes ONLY
    this.name = name;
    this.sectionNumber = sectionNumber;
    this.classNumber = classNumber;
    this.type = type;
    this.days = days;
    this.startTime = startTime;
    this.endTime = endTime;
    this.open = open;
    this.location = location;
    this.prof = prof;
    this.sectionArray = [];  //each course contains a section array that holds each of its different sections
}


addToCart(new course("BIO", "08", "1009", "SEM", "MW", "8", "9:15 AM", true, "CBA-140A", "Lacey J"));
addToCart(new course("BIO", "09", "1009", "SEM", "MW", "8", "9:15 AM", true, "CBA-140A", "Michael"));  //test to see if add method works

var viewModel = new Observable.Observable({
	title: "Cart",
    items: new ObservableArray.ObservableArray([  //need to display courses properly, not sure how to use for loop to display each course

        {
            name: cart[0].name, prof: cart[0].sectionNumber
        },

        {
            name: cart[0].sectionArray[0]
        }
    ])
});


function pageLoaded(args) {   //screen's binding context is the above mentioned view model object that holds the observables
    var page = args.object;
    page.bindingContext = viewModel;
}
exports.pageLoaded = pageLoaded;



// ignore this
/*function buttonTap(args) {  //tapping the 'remove class' button removes two labels at once, not supposed to do that
    var btn = args.object;
    var tappedItemData = btn.bindingContext;

    viewModel.items.some(function(item, index) {
        if (item.id === tappedItemData.id) {
            viewModel.items.splice(index, 1);
            return false;
        }
        return true;
    });

}
exports.buttonTap = buttonTap;*/