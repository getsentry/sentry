import Router from "react-router";

var router = Router.create({
  routes: require("./routes"),
  location: Router.HistoryLocation,
  onError: function(err) {
    console.log('here');
    debugger;
  },
  onAbort: function(err) {
    console.log('abort');
    debugger;
  }
});

export default router;
