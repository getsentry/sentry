import React from 'react';
import _ from 'underscore';

import GroupEventDataSection from './eventDataSection';
import {objectIsEmpty, toTitleCase, defined} from '../../utils';

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
    orgId: React.PropTypes.string,
    projectId: React.PropTypes.string
  },

  renderTitle() {
    let {value, alias, type} = this.props;
    let title = null;
    if (defined(value.title)) {
      title = value.title;
    } else {
      let Component = CONTEXT_TYPES[type] || CONTEXT_TYPES.default;
      if (Component.getTitle) {
        title = Component.getTitle(value);
      }
      if (!defined(title)) {
        title = toTitleCase(alias);
      }
    }

    return (
      <span>
        {title + ' '}
        {alias !== type ? <small>({alias})</small> : null}
      </span>
    );
  },

  render() {
    let {group, orgId, projectId, type, alias, value} = this.props;
    let evt = this.props.event;
    let Component = CONTEXT_TYPES[type] || CONTEXT_TYPES.default;

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          key={`context-${alias}`}
          type={`context-${alias}`}
          title={this.renderTitle()}>
        <Component alias={alias} data={value} groupId={group.id} orgId={orgId} projectId={projectId}/>
      </GroupEventDataSection>
    );
  },
});

const ContextsInterface = React.createClass({
  propTypes: {
    event: React.PropTypes.object.isRequired,
    group: React.PropTypes.object.isRequired,
    orgId: React.PropTypes.string,
    projectId: React.PropTypes.string
  },

  render() {
    let evt = this.props.event;
    let children = [];

    let passedProps = _.pick(this.props, 'group', 'event', 'orgId', 'projectId');

    if (!objectIsEmpty(evt.user)) {
      children.push((
        <ContextChunk {...passedProps}
          type="user"
          alias="user"
          value={evt.user}
          key="user" />
      ));
    }

    let value;
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

    return <div>{children}</div>;
  },
});

export default ContextsInterface;
