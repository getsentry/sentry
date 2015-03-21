/*** @jsx React.DOM */

var React = require("react");

var Footer = React.createClass({
  render() {
    var version = this.props.version.current;

    return (
      <footer>
        <div className="container">
          <div className="pull-right">
            <a href={this.props.urlPrefix + '/docs/'}>Docs</a>
            <a href="https://github.com/getsentry/sentry">Contribute</a>
          </div>
          <div className="version pull-left">
            Sentry {version}
          </div>
          <span className="icon-sentry-logo"></span>
        </div>
      </footer>
    );
  }
});

module.exports = Footer;
