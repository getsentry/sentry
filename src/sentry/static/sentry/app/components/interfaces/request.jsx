var React = require("react");

var ConfigStore = require("../../stores/configStore");
var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../proptypes");
var utils = require("../../utils");

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

var RequestInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired
  },

  contextTypes: {
    organization: PropTypes.Organization.isRequired,
    project: PropTypes.Project.isRequired
  },

  render: function(){
    var group = this.props.group;
    var evt = this.props.event;
    var data = this.props.data;

    var fullUrl = data.url;
    if (data.query_string) {
      fullUrl = fullUrl + '?' + data.query_string;
    }
    if (data.fragment) {
      fullUrl = fullUrl + '#' + data.fragment;
    }

    var headers = [];
    for (var key in data.headers) {
      headers.push(<dt key={'dt-' + key }>{key}</dt>);
      headers.push(<dd key={'dd-' + key }><pre>{data.headers[key]}</pre></dd>);
    }

    // lol
    var parsedUrl = document.createElement("a");
    parsedUrl.href = fullUrl;

    var org = this.context.organization;
    var project = this.context.project;
    var urlPrefix = (
      ConfigStore.get('urlPrefix') + '/' + org.slug + '/' +
      project.slug + '/group/' + group.id
    );

    var title = (
      <h3>
        <strong>{data.method || 'GET'} <a href={fullUrl}>{parsedUrl.pathname}</a></strong>
        <div className="pull-right">
          {parsedUrl.hostname}
          <a href={urlPrefix + '/events/' + evt.id + '/replay/'}
             className="btn btn-sm btn-default">Replay Request</a>
        </div>
      </h3>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          wrapTitle={false}
          title={title}>
        {data.query_string &&
          <ClippedBox title="Query String">
            <pre>{data.query_string}</pre>
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
        {!utils.objectIsEmpty(data.headers) &&
          <ClippedBox title="Headers">
            <DefinitionList data={data.headers} />
          </ClippedBox>
        }
        {!utils.objectIsEmpty(data.env) &&
          <ClippedBox title="Environment" defaultCollapsed>
            <dl className="vars">
              <DefinitionList data={data.env} />
            </dl>
          </ClippedBox>
        }
      </GroupEventDataSection>
    );
  }
});

module.exports = RequestInterface;
