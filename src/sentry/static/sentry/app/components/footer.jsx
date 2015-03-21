/*** @jsx React.DOM */

var React = require("react");

var Footer = React.createClass({
  render() {
    return (
      <footer>
        <div className="container">
          <div className="pull-right">
            <a href="/docs">Docs</a>
            <a href="https://github.com/getsentry/sentry">Contribute</a>
          </div>
          <div className="version pull-left">Sentry sentry_version.current <a href="#" title="You're running an old version of Sentry, did you know sentry_version.latest is available?" class="tip icon-circle-arrow-up">&nbsp;</a></div>
          <span className="icon-sentry-logo"></span>
        </div>
      </footer>
    );
  }
});

module.exports = Footer;
