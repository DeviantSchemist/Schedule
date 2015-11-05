"use strict";
var Q = require("q");
/**
* Generates a promise to retrieve all professors from RateMyProfessor
* @return {Promise}
*/
function getProfessor(firstInitial, lastName) {
 firstInitial = firstInitial.toLowerCase();
 lastName = lastName.toLowerCase();
 var url = "http://search.mtvnservices.com/typeahead/suggest/?solrformat=true&rows=10&q="+firstInitial+"+"+lastName+"+AND+schoolid_s%3A162&sort=&siteName=rmp&rows=20&start=0&fl=pk_id+teacherfirstname_t+teacherlastname_t+total_number_of_ratings_i+averageratingscore_rf+schoolid_s";
 console.log("get professor:"+url);
 return fetch(url)
  .then(function(t){console.log("fetched"); return t.json();})
  .then(function(results) {
   return Q.Promise(function (resolve, reject) {
    console.log("get teacher");
    console.log(JSON.stringify(results));
     // convert results to a javascript object
     // verify that the API generated a good result
     if(results.responseHeader && results.responseHeader.status === 0) {
       // take the results
       var numFound = results.response.numFound;
       var start = results.response.start;
       var response = results.response.docs;
       //number of ratings found for professors with the same last name and first initial
       var numOfRatings = 0;
       //URL to resolve in case of multiple professors with the same name
       var searchURL = "http://www.ratemyprofessors.com/search.jsp?queryBy=teacherName&schoolName=California+State+University+Long+Beach&queryoption=HEADER&query="+lastName+"&facetSearch=true";
       var ratings;
       // iterate through each item (teacher) in the documents
       for(var i = 0; i < response.length; i++) {
         var teacher = response[i];

         // check if teacher name is a match
         if(teacher.teacherfirstname_t.toLowerCase().indexOf(firstInitial) === 0 && teacher.teacherlastname_t.toLowerCase() === lastName) {
           ratings = {
             "firstName": teacher.teacherfirstname_t,
             "lastName": teacher.teacherlastname_t,
             "rating": teacher.averageratingscore_rf
           };

           numOfRatings++;
         }
       }
       //if there are multiple professors with the same last name and first initial, resolve the url for the RMP site
       if(numOfRatings>1){
        resolve(searchURL);
        return;
       }
       // if it's a single match, resolve the Promise and return (to stop the execution of this function)
       else if(numOfRatings===1){
        resolve(ratings);
        return;
       } 

     } else {
       reject(results);
     }
     // if we didn't find a teacher, resolve undefined.
     resolve(undefined);
   });
 });
}
module.exports = {
  getProfessor: getProfessor
};