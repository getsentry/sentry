import React from 'react';

import GroupEventDataSection from './eventDataSection';
import plugins from '../../plugins';
import {objectIsEmpty, toTitleCase, defined} from '../../utils';

const CONTEXT_TYPES = {
  default: require('./contexts/default').default,
  app: require('./contexts/app').default,
  device: require('./contexts/device').default,
  os: require('./contexts/os').default,
  runtime: require('./contexts/runtime').default,
  user: require('./contexts/user').default
};

function getContextComponent(type) {
  return CONTEXT_TYPES[type] || plugins.contexts[type] || CONTEXT_TYPES.default;
}

function getSourcePlugin(pluginContexts, contextType) {
  if (CONTEXT_TYPES[contextType]) {
    return null;
  }
  for (let plugin of pluginContexts) {
    if (plugin.contexts.indexOf(contextType) >= 0) {
      return plugin;
    }
  }
  return null;
}

const ContextChunk = React.createClass({
  propTypes: {
    event: React.PropTypes.object.isRequired,
    group: React.PropTypes.object.isRequired,
    type: React.PropTypes.string.isRequired,
    alias: React.PropTypes.string.isRequired,
    value: React.PropTypes.object.isRequired
  },

  getInitialState() {
    return {
      isLoading: false
    };
  },

  componentWillMount() {
    this.syncPlugin();
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.group.id != this.props.group.id || prevProps.type != this.props.type) {
      this.syncPlugin();
    }
  },

  syncPlugin() {
    let sourcePlugin = getSourcePlugin(this.props.group.pluginContexts, this.props.type);
    if (!sourcePlugin) {
      this.setState({
        pluginLoading: false
      });
    } else {
      this.setState(
        {
          pluginLoading: true
        },
        () => {
          plugins.load(sourcePlugin, () => {
            this.setState({pluginLoading: false});
          });
        }
      );
    }
  },

  renderTitle(component) {
    let {value, alias, type} = this.props;
    let title = null;
    if (defined(value.title)) {
      title = value.title;
    } else {
      if (component.getTitle) {
        title = component.getTitle(value);
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
    // if we are currently loading the plugin, just render nothing for now.
    if (this.state.pluginLoading) {
      return null;
    }

    let group = this.props.group;
    let evt = this.props.event;
    let {type, alias, value} = this.props;
    let Component = getContextComponent(type);

    // this can happen if the component does not exist
    if (!Component) {
      return null;
    }

    return (
      <GroupEventDataSection
        group={group}
        event={evt}
        key={`context-${alias}`}
        type={`context-${alias}`}
        title={this.renderTitle(Component)}>
        <Component alias={alias} data={value} />
      </GroupEventDataSection>
    );
  }
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
      children.push(
        <ContextChunk
          group={group}
          event={evt}
          type="user"
          alias="user"
          value={evt.user}
          key="user"
        />
      );
    }

    let value = null;
    for (let key in evt.contexts) {
      value = evt.contexts[key];
      children.push(
        <ContextChunk
          group={group}
          event={evt}
          type={value.type}
          alias={key}
          value={value}
          key={key}
        />
      );
    }

    return <div>{children}</div>;
  }
});

export default ContextsInterface;
