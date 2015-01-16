/** @jsx React.DOM */

var Reflux = require("reflux");

var AlertActions = Reflux.createActions(["addAlert", "closeAlert"]);

module.exports = AlertActions;
