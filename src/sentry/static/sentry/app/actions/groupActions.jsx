
var Reflux = require("reflux");


// TODO(dcramer): we should probably just make every parameter update
// work on bulk groups
var GroupActions = Reflux.createActions([
  "assignTo",
  "assignToError",
  "assignToSuccess",
  "delete",
  "deleteError",
  "deleteSuccess",
  "update",
  "updateError",
  "updateSuccess",
  "merge",
  "mergeError",
  "mergeSuccess"
]);


module.exports = GroupActions;
