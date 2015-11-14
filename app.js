var application = require("application");
application.mainModule = "main-page";
application.cssFile = "app.css";

require('nativescript-livesync');
application.start();
