/*global phantom:true console:true console_reporter:true */

// Runs a Jasmine Suite from an html page
// @page is a PhantomJs page object
// @exit_func is the function to call in order to exit the script

(function(phantom, WebPage){
  "use strict";

  var PhantomJasmineRunner = function(page, exit_func){
    this.page = page;
    this.exit_func = exit_func || phantom.exit;
    this.tries = 0;
    this.max_tries = 10;

    this.get_status = function(){
      return this.page.evaluate(function(){
        return console_reporter.status;
      });
    };

    this.terminate = function(){
      var status = this.get_status();
      if (status === 'success') {
        this.exit_func(0);
      } else if (status === 'fail') {
        this.exit_func(1);
      } else {
        this.exit_func(2);
      }
    };
  };

  // Script Begin
  if (phantom.args.length === 0) {
    console.log("Need a url as the argument");
    phantom.exit(1);
  }

  var page = new WebPage();
  var runner = new PhantomJasmineRunner(page);
  var address = phantom.args[0];

  // Don't supress console output
  page.onConsoleMessage = function(msg){
    console.log(msg);

    // Terminate when the reporter singals that testing is over.
    // We cannot use a callback function for this (because page.evaluate is sandboxed),
    // so we have to *observe* the website.
    if (msg == "ConsoleReporter finished") {
      runner.terminate();
    }
  };

  page.open(address, function(status){
    if (status != "success") {
      console.log("can't load the address!");
      phantom.exit(1);
    }
    // Now we wait until onConsoleMessage reads the termination signal from the log.
  });

}(phantom, WebPage));