/*jshint expr: true*/
var React = require("react/addons");
var Cookies = require("js-cookie");

var api = require("app/api");
import {getJavaFrame, getPHPFrame, getPHPException} from "app/components/interfaces/rawStacktraceContent";

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

  describe('getPHPFrame()', function () {
    it('should render PHP frames', function () {
      expect(getPHPFrame({
        module: 'Raven_Client',
        function: 'capture',
        filename: '/raven-php/lib/Raven/Client.php',
        lineNo: 302
      }, 0)).to.eql('#0 /raven-php/lib/Raven/Client.php(302): Raven_Client->capture()');

      // without line number
      expect(getPHPFrame({
        module: 'Raven_Client',
        function: 'capture',
        filename: '/raven-php/lib/Raven/Client.php'
      }, 0)).to.eql('#0 /raven-php/lib/Raven/Client.php: Raven_Client->capture()');

      // without line number and filename
      expect(getPHPFrame({
        module: 'Raven_Client',
        function: 'capture',
      }, 0)).to.eql('#0 Raven_Client->capture()');
    });
  });

  describe('getPHPException()', function () {
    it('should render PHP exception', function () {
      expect(getPHPException({
        type: 'Exception',
        value: 'something bad happened',
        module: '/raven-php/lib/Raven/Client.php:302' // module contains path + lineno for PHP
      })).to.eql('Exception: something bad happened in /raven-php/lib/Raven/Client.php:302\nStack trace:');

      expect(getPHPException({
        type: 'Exception',
        value: 'something bad happened'
      })).to.eql('Exception: something bad happened\nStack trace:');
    });
  });
});
