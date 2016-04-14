import React from 'react';
import moment from 'moment';

import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';

import MessageCrumbComponent from './breadcrumbComponents/message';
import RpcCrumbComponent from './breadcrumbComponents/rpc';
import QueryCrumbComponent from './breadcrumbComponents/query';
import HttpRequestCrumbComponent from './breadcrumbComponents/httpRequest';
import UiEventComponent from './breadcrumbComponents/uiEvent';
import NavigationCrumbComponent from './breadcrumbComponents/navigation';
import ErrorCrumbComponent from './breadcrumbComponents/error';

const CRUMB_COMPONENTS = {
  message: MessageCrumbComponent,
  rpc: RpcCrumbComponent,
  query: QueryCrumbComponent,
  http_request: HttpRequestCrumbComponent,
  ui_event: UiEventComponent,
  navigation: NavigationCrumbComponent,
  error: ErrorCrumbComponent
};

function Collapsed(props) {
  return (
    <li className="crumbs-collapsed">
      <span className="icon-container">
        <span className="icon icon-ellipsis"/>
      </span>
      <a onClick={props.onClick}>Show {props.count} collapsed crumbs</a>
    </li>
  );
}
Collapsed.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  count: React.PropTypes.number.isRequired
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

  statics: {
    MAX_CRUMBS_WHEN_COLLAPSED: 5
  },

  getInitialState() {
    return {
      collapsed: true
    };
  },

  onCollapseToggle() {
    this.setState({
      collapsed: !this.state.collapsed
    });
  },

  renderBreadcrumbs(crumbs) {
    // reverse array to get consistent idx between collapsed/expanded state
    // (indexes begin and increment from last breadcrumb)
    return crumbs.reverse().map((item, idx) => {
      let Component = CRUMB_COMPONENTS[item.type];
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
          <span className="dt">{moment(item.timestamp).format('HH:mm:ss')}</span>
          {el}
        </li>
      );
    }).reverse(); // un-reverse rendered result
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let data = this.props.data;

    let title = (
      <div>
        <h3>
          <strong>{'Breadcrumbs'}</strong>
        </h3>
      </div>
    );

    let all = data.values;

    // Add the error event as the final breadcrumb
    // TODO: what about non-exceptions (e.g. generic messages)?
    let exception = evt.entries.find(entry => entry.type === 'exception');
    if (exception) {
      // make copy of values array / don't mutate props
      all = all.slice(0).concat([{
        type: 'error',
        data: exception.data.values[0],
        timestamp: evt.dateCreated
      }]);
    }

    // cap max number of breadcrumbs to show
    let crumbs = all;
    const MAX = BreadcrumbsInterface.MAX_CRUMBS_WHEN_COLLAPSED;
    if (this.state.collapsed && crumbs.length > MAX) {
      crumbs = all.slice(-MAX);
    }

    let numCollapsed = all.length - crumbs.length;

    return (
      <GroupEventDataSection
          className="breadcrumb-box"
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        <ul className="crumbs">
          {numCollapsed > 0 && <Collapsed onClick={this.onCollapseToggle} count={numCollapsed}/>}
          {this.renderBreadcrumbs(crumbs)}
        </ul>
      </GroupEventDataSection>
    );
  }
});

export default BreadcrumbsInterface;
