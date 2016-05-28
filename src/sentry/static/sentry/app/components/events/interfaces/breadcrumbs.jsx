import React from 'react';

import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';

import Breadcrumb from './breadcrumbs/breadcrumb';

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

function moduleToCategory(module) {
  if (!module) {
    return null;
  }
  let match = module.match(/^.*\/(.*?)(:\d+)/);
  if (match) {
    return match[1];
  }
  return module.split(/./)[0];
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
    MAX_CRUMBS_WHEN_COLLAPSED: 10
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
      return <Breadcrumb key={idx} crumb={item} />;
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
      let {type, value, module} = exception.data.values[0];
      // make copy of values array / don't mutate props
      all = all.slice(0).concat([{
        type: 'error',
        level: 'error',
        category: moduleToCategory(module || null) || 'error',
        data: {
          type: type,
          value: value
        },
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
