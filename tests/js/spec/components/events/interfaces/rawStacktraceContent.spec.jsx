import {getJavaFrame} from "app/components/events/interfaces/rawStacktraceContent";

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
