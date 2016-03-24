import React from 'react';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';

import MessageCrumbComponent from './breadcrumbComponents/message';
import RpcCrumbComponent from './breadcrumbComponents/rpc';
import QueryCrumbComponent from './breadcrumbComponents/query';
import HttpRequestCrumbComponent from './breadcrumbComponents/httpRequest';
import UiEventComponent from './breadcrumbComponents/uiEvent';
import NavigationCrumbComponent from './breadcrumbComponents/navigation';
import ErrorCrumbComponent from './breadcrumbComponents/error';

const crumbComponents = {
  message: MessageCrumbComponent,
  rpc: RpcCrumbComponent,
  query: QueryCrumbComponent,
  http_request: HttpRequestCrumbComponent,
  ui_event: UiEventComponent,
  navigation: NavigationCrumbComponent,
  error: ErrorCrumbComponent
};

const BreadcrumbsInterface = React.createClass({
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
          <strong>Breadcrumbs</strong>
        </h3>
      </div>
    );

    // Add the error event as the final breadcrumb
    let crumbs = [].slice.call(data.items, 0);

    let exception = evt.entries.find(entry => entry.type === 'exception');
    if (exception) {
      crumbs.push({
        type: 'error',
        dt: 0,
        data: exception.data.values[0]
      });
    }

    let renderedCrumbs = crumbs.map((item, idx) => {
      let Component = crumbComponents[item.type];
      let el;
      if (Component) {
        el = <Component data={item.data} />;
      } else {
        el = <div className="errors">Missing crumb "{item.type}"</div>;
      }
      return (
        <li key={idx} className={'crumb crumb-' + item.type.replace(/_/g, '-')}>
          <span className="icon-container">
            <span className="icon"/>
          </span>
          <span className="dt">{Math.round(item.dt * 1000) / 1000}ms</span>
          {el}
        </li>
      );
    });

    return (
      <GroupEventDataSection
          className="breadcrumb-box"
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        <ul className="crumbs">
          <li className="crumbs-collapsed">
            <span className="icon-container">
              <span className="icon icon-ellipsis"/>
            </span>
            <a>Show 12 collapsed crumbs</a>
          </li>
          {renderedCrumbs}
        </ul>
      </GroupEventDataSection>
    );
  }
});

export default BreadcrumbsInterface;
