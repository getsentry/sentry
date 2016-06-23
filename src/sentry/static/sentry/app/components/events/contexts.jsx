import React from 'react';

import GroupEventDataSection from './eventDataSection';
import {objectIsEmpty, toTitleCase} from '../../utils';
import {t} from '../../locale';

const CONTEXT_TYPES = {
  'default': require('./contexts/default'),
  'device': require('./contexts/device'),
  'os': require('./contexts/os'),
  'runtime': require('./contexts/runtime'),
  'user': require('./contexts/user'),
};

const ContextChunk = React.createClass({
  propTypes: {
    type: React.PropTypes.string.isRequired,
    alias: React.PropTypes.string.isRequired,
    value: React.PropTypes.object.isRequired,
  },

  render() {
    let {type, alias, value} = this.props;
    let title = value.title || toTitleCase(alias);
    let Component = CONTEXT_TYPES[type] || CONTEXT_TYPES.default;

    return (
      <div className="context-box">
        <div className="context-header">
          <h5>
            <strong>{title}</strong>
            {value.title &&
              <small> ({name})</small>
            }
          </h5>
        </div>
        <div className="context-content">
          <Component alias={alias} data={value} />
        </div>
      </div>
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
          type={value.type}
          alias={key}
          value={value}
          key={key} />
      ));
    }

    return (
      <GroupEventDataSection
          className="context-section"
          group={group}
          event={evt}
          key="context"
          type="contexts"
          title={t('Context')}>
        {children}
      </GroupEventDataSection>
    );
  },
});

export default ContextsInterface;
