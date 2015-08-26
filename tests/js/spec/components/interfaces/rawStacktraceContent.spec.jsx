var React = require("react/addons");
var Cookies = require("js-cookie");

var api = require("app/api");
import {getJavaFrame} from "app/components/interfaces/rawStacktraceContent";

var TestUtils = React.addons.TestUtils;

describe("RawStacktraceContent", function() {
  describe("getJavaFrame()", function() {
    it('should render java frames', function () {
      expect(getJavaFrame({
        module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
        function: 'run',
        filename: 'QueuedThreadPool.java',
        lineNo: 582
      })).to.eql('    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java:582)');

      // without line number
      expect(getJavaFrame({
        module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
        function: 'run',
        filename: 'QueuedThreadPool.java'
      })).to.eql('    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java)');

      // without line number and filename
      expect(getJavaFrame({
        module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
        function: 'run'
      })).to.eql('    at org.mortbay.thread.QueuedThreadPool$PoolThread.run');
    });
  });
});
