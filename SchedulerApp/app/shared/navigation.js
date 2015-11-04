var config = require("./config");
var frameModule = require("ui/frame");

module.exports = {
	goToSessions: function() {
		frameModule.topmost().navigate("views/sessions/sessions");
	},
	startingPage: function() {
		return "views/sessions/sessions";
	}
};