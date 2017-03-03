import render, {getJavaFrame, getJavaPreamble} from 'app/components/events/interfaces/rawStacktraceContent';

describe('RawStacktraceContent', function() {
  describe('getJavaFrame()', function() {
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

  describe('getJavaPreamble()', function () {
    expect(getJavaPreamble({
      type: 'Baz',
      value: 'message'
    })).to.eql('Baz: message');

    expect(getJavaPreamble({
      module: 'foo.bar',
      type: 'Baz',
      value: 'message'
    })).to.eql('foo.bar.Baz: message');
  });

  describe('render()', function () {
    let exception = {
          module: 'example.application',
          type: 'Error',
          value: 'an error occurred'
        },
        data = {
          frames: [
            {
              function: 'main',
              module: 'example.application',
              lineNo: 1,
              filename: 'application'
            },
            {
              function: 'doThing',
              module: 'example.application',
              lineNo: 2,
              filename: 'application'
            }
          ]
        };

    expect(render(data, 'java', exception)).to.eql(
`example.application.Error: an error occurred
    at example.application.doThing(application:2)
    at example.application.main(application:1)`);

    expect(render(data, 'python', exception)).to.eql(
`Error: an error occurred
  File "application", line 1, in main
  File "application", line 2, in doThing`);
  });
});

