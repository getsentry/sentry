var React = require("react");

var ConfigStore = require("../stores/configStore");

var Footer = React.createClass({
  render() {
    var config = ConfigStore.getConfig();

    return (
      <footer>
        <div className="container">
          <div className="pull-right">
            <a href={config.urlPrefix + '/docs/'}>Docs</a>
            <a href="https://github.com/getsentry/sentry">Contribute</a>
          </div>
          <div className="version pull-left">
            Sentry {config.version.current}
          </div>
          <a href="/" className="icon-sentry-logo"></a>
        </div>
      </footer>
    );
  }
});

module.exports = Footer;
