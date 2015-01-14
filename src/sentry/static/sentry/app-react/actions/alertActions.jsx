/** @jsx React.DOM */

var Reflux = require("reflux");

var alertActions = Reflux.createActions(["addAlert", "closeAlert"]);

module.exports = alertActions;
