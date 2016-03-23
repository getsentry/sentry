import React from 'react';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';

import MessageCrumbComponent from './breadcrumbComponents/message';
import RpcCrumbComponent from './breadcrumbComponents/rpc';
import QueryCrumbComponent from './breadcrumbComponents/query';
import HttpRequestCrumbComponent from './breadcrumbComponents/httpRequest';
import UiEventComponent from './breadcrumbComponents/uiEvent';
import NavigationCrumbComponent from './breadcrumbComponents/navigation';

const crumbComponents = {
  message: MessageCrumbComponent,
  rpc: RpcCrumbComponent,
  query: QueryCrumbComponent,
  http_request: HttpRequestCrumbComponent,
  ui_event: UiEventComponent,
  navigation: NavigationCrumbComponent
};


let BreadcrumbsInterface = React.createClass({
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
    let group = this.props.group;
    let evt = this.props.event;
    let data = this.props.data;

    let title = (
      <div>
        <h3>
          <strong>Breadcrumbs</strong>{' '}
          <small>(significant events that lead up to this)</small>
        </h3>
      </div>
    );

    let crumbs = data.items.map((item, idx) => {
      let Component = crumbComponents[item.type];
      let el;
      if (Component) {
        el = <Component data={item.data} />;
      } else {
        el = <div className="errors">Missing crumb "{item.type}"</div>;
      }
      return (
        <li key={idx} className={'crumb crumb-' + item.type.replace(/_/g, '-')}>
          <span className="dt">{Math.round(item.dt * 1000) / 1000}ms</span>
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
