import React from "react";
import GroupEventDataSection from "../eventDataSection";
import PropTypes from "../../../proptypes";

import TimeSince from "../../../components/timeSince";

import MessageCrumbComponent from "./breadcrumb-components/message";
import RpcCrumbComponent from "./breadcrumb-components/rpc";
import QueryCrumbComponent from "./breadcrumb-components/query";
import HttpRequestCrumbComponent from "./breadcrumb-components/httpRequest";


const crumbComponents = {
  message: MessageCrumbComponent,
  rpc: RpcCrumbComponent,
  query: QueryCrumbComponent,
  http_request: HttpRequestCrumbComponent,
};


var BreadcrumbsInterface = React.createClass({
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

  render() {
    var group = this.props.group;
    var evt = this.props.event;
    var data = this.props.data;

    var title = (
      <div>
        <h3>
          <strong>Breadcrumbs</strong>{' '}
          <small>(significant events that lead up to this)</small>
        </h3>
      </div>
    );

    var crumbs = data.items.map((item, idx) => {
      var Component = crumbComponents[item.type];
      var el;
      if (Component) {
        el = <Component data={item.data} />;
      } else {
        el = <div className="errors">Missing crumb "{item.type}"</div>;
      }
      var ts = new Date(item.timestamp);
      return (
        <li key={idx} className={'crumb crumb-' + item.type.replace(/_/g, '-')}>
          <TimeSince date={ts} />
          {el}
        </li>
      );
    });

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        <ul className="crumbs">{crumbs}</ul>
      </GroupEventDataSection>
    );
  }
});

export default BreadcrumbsInterface;
