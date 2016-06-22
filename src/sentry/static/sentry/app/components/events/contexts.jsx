import React from 'react';

import GroupEventDataSection from './eventDataSection';
import {toTitleCase} from '../../utils';

const CONTEXT_TYPES = {
  'default': require('./contexts/default'),
  'device': require('./contexts/device'),
  'os': require('./contexts/os'),
  'runtime': require('./contexts/runtime'),
};


const ContextsInterface = React.createClass({
  propTypes: {
    event: React.PropTypes.object.isRequired,
    group: React.PropTypes.object.isRequired
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let rv = [];
    for (let key in evt.contexts) {
      let value = evt.contexts[key];
      let Component = CONTEXT_TYPES[value.type] || CONTEXT_TYPES.default;

      let title = (
        <div>
          <h3>
            <strong>{value.title || toTitleCase(key)}</strong>
            <small> ({key})</small>
          </h3>
        </div>
      );

      rv.push((
        <GroupEventDataSection
            className="context-box"
            group={group}
            event={evt}
            key={key}
            type={`${key}-context`}
            wrapTitle={false}
            title={title}>
          <Component alias={key} data={value} />
        </GroupEventDataSection>

      ));
    }
    return <div>{rv}</div>;
  },
});

export default ContextsInterface;
