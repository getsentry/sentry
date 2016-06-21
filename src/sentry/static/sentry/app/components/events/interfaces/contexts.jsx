import React from 'react';

import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';


const CONTEXT_TYPES = {
  'default': require('./contexts/default'),
  'device': require('./contexts/device'),
  'os': require('./contexts/os'),
  'runtime': require('./contexts/runtime'),
};


const ContextsInterface = React.createClass({
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

  renderContextData() {
    let rv = [];
    for (let key in this.props.data) {
      let value = this.props.data[key];
      let Component = CONTEXT_TYPES[value.type] || CONTEXT_TYPES.default;
      rv.push(
        <Component key={key} alias={key} data={value}/>
      );
    }
    return rv;
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;

    let title = (
      <div>
        <h3>
          <strong>{'Context'}</strong>
        </h3>
      </div>
    );

    return (
      <GroupEventDataSection
          className="context-box"
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        {this.renderContextData()}
      </GroupEventDataSection>
    );
  }
});

export default ContextsInterface;
