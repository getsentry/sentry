import React from 'react';

import GroupEventDataSection from './eventDataSection';
import {objectIsEmpty, toTitleCase} from '../../utils';

const CONTEXT_TYPES = {
  'default': require('./contexts/default'),
  'device': require('./contexts/device'),
  'os': require('./contexts/os'),
  'runtime': require('./contexts/runtime'),
  'user': require('./contexts/user'),
};

const ContextChunk = React.createClass({
  propTypes: {
    event: React.PropTypes.object.isRequired,
    group: React.PropTypes.object.isRequired,
    type: React.PropTypes.string.isRequired,
    alias: React.PropTypes.string.isRequired,
    value: React.PropTypes.object.isRequired,
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let {type, alias, value} = this.props;
    let title = value.title || toTitleCase(alias);
    let Component = CONTEXT_TYPES[type] || CONTEXT_TYPES.default;

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          key={`context-${alias}`}
          type={`context-${alias}`}
          title={title}>
        <Component alias={alias} data={value} />
      </GroupEventDataSection>
    );
  },
});

const ContextsInterface = React.createClass({
  propTypes: {
    event: React.PropTypes.object.isRequired,
    group: React.PropTypes.object.isRequired
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let children = [];
    if (!objectIsEmpty(evt.user)) {
      children.push((
        <ContextChunk
          group={group}
          event={evt}
          type="user"
          alias="user"
          value={evt.user}
          key="user" />
      ));
    }

    let value = null;
    for (let key in evt.contexts) {
      value = evt.contexts[key];
      children.push((
        <ContextChunk
          group={group}
          event={evt}
          type={value.type}
          alias={key}
          value={value}
          key={key} />
      ));
    }

    return <div>{children}</div>;
  },
});

export default ContextsInterface;
