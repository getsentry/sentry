/*jshint expr: true*/
var React = require("react/addons");
var Cookies = require("js-cookie");

var api = require("app/api");
var RawStacktraceContent = require("app/components/interfaces/rawStacktraceContent");

var TestUtils = React.addons.TestUtils;

describe("RawStacktraceContent", function() {
  describe("getJavaFrame()", function() {
    it('should render java frames', function () {
      var data = { frames: [] };
      var elem = TestUtils.renderIntoDocument(<RawStacktraceContent data={data} />);

      expect(elem.getJavaFrame({
        module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
        function: 'run',
        filename: 'QueuedThreadPool.java',
        lineNo: 582
      })).to.eql('    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java:582)');

      // without line number
      expect(elem.getJavaFrame({
        module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
        function: 'run',
        filename: 'QueuedThreadPool.java'
      })).to.eql('    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java)');

      // without line number and filename
      expect(elem.getJavaFrame({
        module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
        function: 'run'
      })).to.eql('    at org.mortbay.thread.QueuedThreadPool$PoolThread.run');
    });
  });
});
