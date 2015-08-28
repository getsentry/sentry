import React from "react";
import ConfigStore from "../../stores/configStore";
import GroupEventDataSection from "../eventDataSection";
import PropTypes from "../../proptypes";
import RichHttpContent from "./richHttpContent";
import {getCurlCommand} from "./utils";

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
    if (data.query) {
      fullUrl = fullUrl + '?' + data.query;
    }
    if (data.fragment) {
      fullUrl = fullUrl + '#' + data.fragment;
    }

    // lol
    var parsedUrl = document.createElement("a");
    parsedUrl.href = fullUrl;

    var title = (
      <div>
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
        <h3>
          <strong>{data.method || 'GET'} <a href={fullUrl}>{parsedUrl.pathname}</a></strong>
          <small style={{marginLeft: 20}}>{parsedUrl.hostname}</small>
        </h3>
      </div>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        {view === "curl" ?
          <pre>{getCurlCommand(data)}</pre>
        :
          <RichHttpContent data={data} />
        }
      </GroupEventDataSection>
    );
  }
});

export default RequestInterface;
