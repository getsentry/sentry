var React = require("react");
var jQuery = require("jquery");

var ConfigStore = require("../../stores/configStore");
var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../proptypes");
var {defined, objectIsEmpty} = require("../../utils");

var ClippedBox = React.createClass({
  propTypes: {
    title: React.PropTypes.string.isRequired,
    defaultClipped: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      defaultClipped: false,
      clipHeight: 200
    };
  },

  getInitialState() {
    return {
      clipped: this.props.defaultClipped
    };
  },

  componentDidMount() {
    var renderedHeight = this.getDOMNode().offsetHeight;

    if (renderedHeight > this.props.clipHeight ) {
      this.setState({
        clipped: true
      });
    }
  },

  reveal() {
    this.setState({
      clipped: false
    });
  },

  render() {
    var className = "box-clippable";
    if (this.state.clipped) {
      className += " clipped";
    }

    return (
      <div className={className}>
        <h5>{this.props.title}</h5>
        {this.props.children}
        <div className="clip-fade">
          <a onClick={this.reveal} className="show-more btn btn-primary btn-xs">Show more</a>
        </div>
      </div>
    );
  }
});

var DefinitionList = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  render() {
    var children = [];
    var data = this.props.data;
    for (var key in data) {
      children.push(<dt key={'dt-' + key }>{key}</dt>);
      children.push(<dd key={'dd-' + key }><pre>{data[key]}</pre></dd>);
    }
    return <dl className="vars">{children}</dl>;
  }
});

var RequestActions = React.createClass({
  render(){
    var org = this.props.organization;
    var project = this.props.project;
    var group = this.props.group;
    var evt = this.props.event;
    var urlPrefix = (
      ConfigStore.get('urlPrefix') + '/' + org.slug + '/' +
      project.slug + '/group/' + group.id
    );

    return (
      <a href={urlPrefix + '/events/' + evt.id + '/replay/'}
         className="btn btn-sm btn-default">Replay Request</a>
    );
  }
});

var CurlHttpContent = React.createClass({
  escapeQuotes(v) {
    return v.replace(/"/g, '\\"');
  },

  // TODO(dcramer): support cookies
  getCurlCommand() {
    var data = this.props.data;
    var result = 'curl';
    if (defined(data.method) && data.method !== 'GET') {
      result += ' \\\n -X ' + data.method;
    }
    if (defined(data.headers['Accept-Encoding']) && data.headers['Accept-Encoding'].indexOf('gzip') === 1) {
      result += ' \\\n --compressed';
    }
    for (var key in data.headers) {
      result += ' \\\n -H "' + key + ': ' + this.escapeQuotes(data.headers[key]) + '"';
    }
    if (typeof data.data === "string") {
      result += ' \\\n  --data "' + this.escapeQuotes(data.data) + '"';
    } else if (defined(data.data)) {
      result += ' \\\n  --data "' + this.escapeQuotes(jQuery.param(data.data)) + '"';
    }
    result += ' \\\n ' + data.url;
    if (defined(data.query) && data.query) {
      result += '?' + data.query;
    }
    return result;
  },

  render() {
    return <pre>{this.getCurlCommand()}</pre>;
  }
});


var RichHttpContent = React.createClass({
  render(){
    var data = this.props.data;

    var headers = [];
    for (var key in data.headers) {
      headers.push(<dt key={'dt-' + key }>{key}</dt>);
      headers.push(<dd key={'dd-' + key }><pre>{data.headers[key]}</pre></dd>);
    }

    return (
      <div>
        {data.query &&
          <ClippedBox title="Query String">
            <pre>{data.query}</pre>
          </ClippedBox>
        }
        {data.fragment &&
          <ClippedBox title="Fragment">
            <pre>{data.fragment}</pre>
          </ClippedBox>
        }
        {data.data &&
          <ClippedBox title="Body">
            <pre>{data.data}</pre>
          </ClippedBox>
        }
        {data.cookies &&
          <ClippedBox title="Cookies" defaultCollapsed>
            <pre>{JSON.stringify(data.cookies, null, 2)}</pre>
          </ClippedBox>
        }
        {!objectIsEmpty(data.headers) &&
          <ClippedBox title="Headers">
            <DefinitionList data={data.headers} />
          </ClippedBox>
        }
        {!objectIsEmpty(data.env) &&
          <ClippedBox title="Environment" defaultCollapsed>
            <dl className="vars">
              <DefinitionList data={data.env} />
            </dl>
          </ClippedBox>
        }
      </div>
    );
  }
});

var RequestInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    isShare: React.PropTypes.bool
  },

  contextTypes: {
    organization: PropTypes.Organization,
    project: PropTypes.Project
  },

  getInitialState() {
    return {
      view: "rich"
    };
  },

  toggleView(value) {
    this.setState({
      view: value
    });
  },

  render() {
    var group = this.props.group;
    var evt = this.props.event;
    var data = this.props.data;
    var view = this.state.view;

    var fullUrl = data.url;
    if (data.query_string) {
      fullUrl = fullUrl + '?' + data.query_string;
    }
    if (data.fragment) {
      fullUrl = fullUrl + '#' + data.fragment;
    }

    // lol
    var parsedUrl = document.createElement("a");
    parsedUrl.href = fullUrl;

    var title = (
      <div>
        <strong>{data.method || 'GET'} <a href={fullUrl}>{parsedUrl.pathname}</a></strong>
        <small style={{marginLeft: 20}}>{parsedUrl.hostname}</small>
        <div className="pull-right">
          {!this.props.isShare &&
            <RequestActions organization={this.context.organization}
                            project={this.context.project}
                            group={group}
                            event={evt} />
          }
        </div>
        <div className="btn-group">
          <a className={(view === "rich" ? "active" : "") + " btn btn-default btn-sm"}
             onClick={this.toggleView.bind(this, "rich")}>Rich</a>
          <a className={(view === "curl" ? "active" : "") + " btn btn-default btn-sm"}
             onClick={this.toggleView.bind(this, "curl")}><code>curl</code></a>
        </div>
      </div>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}>
        {view === "curl" ?
          <CurlHttpContent data={data} />
        :
          <RichHttpContent data={data} />
        }
      </GroupEventDataSection>
    );
  }
});

module.exports = RequestInterface;
