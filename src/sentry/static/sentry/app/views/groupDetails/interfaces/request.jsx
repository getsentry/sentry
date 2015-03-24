/*** @jsx React.DOM */

var React = require("react");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../../proptypes");
var utils = require("../../../utils");

var CollapsableBox = React.createClass({
  propTypes: {
    title: React.PropTypes.string.isRequired,
    defaultCollapsed: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      defaultCollapsed: false
    };
  },

  getInitialState() {
    return {
      collapsed: this.props.defaultCollapsed
    };
  },

  toggle() {
    this.setState({
      collapsed: !this.state.collapsed
    });
  },

  render() {
    var className = "box-collapsible";
    if (this.state.collapsed) {
      className += " collapsed";
    }

    return (
      <div className={className}>
        <div className="section-toggle">
          <div className="pull-right">
            <a onClick={this.toggle}>
              <span className="icon-arrow-up"></span>
              <span className="icon-arrow-down"></span>
            </a>
          </div>
          <h5>{this.props.title}</h5>
        </div>
        {this.props.children}
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

    var title = (
      <h3>
        <strong>{data.method || 'GET'} <a href={fullUrl}>{parsedUrl.pathname}</a></strong>
        <div className="pull-right">{parsedUrl.hostname}</div>
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
          <CollapsableBox title="Query String">
            <pre>{data.query_string}</pre>
          </CollapsableBox>
        }
        {data.fragment &&
          <CollapsableBox title="Fragment">
            <pre>{data.fragment}</pre>
          </CollapsableBox>
        }
        {data.data &&
          <CollapsableBox title="Body">
            <pre>{data.data}</pre>
          </CollapsableBox>
        }
        {data.cookies &&
          <CollapsableBox title="Cookies" defaultCollapsed>
            <pre>{JSON.stringify(data.cookies, null, 2)}</pre>
          </CollapsableBox>
        }
        {!utils.objectIsEmpty(data.headers) &&
          <CollapsableBox title="Headers">
            <DefinitionList data={data.headers} />
          </CollapsableBox>
        }
        {!utils.objectIsEmpty(data.env) &&
          <CollapsableBox title="Environment" defaultCollapsed>
            <dl className="vars">
              <DefinitionList data={data.env} />
            </dl>
          </CollapsableBox>
        }
      </GroupEventDataSection>
    );
  }
});

module.exports = RequestInterface;
