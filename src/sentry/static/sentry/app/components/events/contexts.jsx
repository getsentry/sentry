import PropTypes from 'prop-types';
import React from 'react';

import {objectIsEmpty, toTitleCase, defined} from 'app/utils';
import GroupEventDataSection from 'app/components/events/eventDataSection';
import plugins from 'app/plugins';

const CONTEXT_TYPES = {
  default: require('app/components/events/contexts/default').default,
  app: require('app/components/events/contexts/app').default,
  device: require('app/components/events/contexts/device').default,
  os: require('app/components/events/contexts/os').default,
  runtime: require('app/components/events/contexts/runtime').default,
  user: require('app/components/events/contexts/user').default,
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

class ContextChunk extends React.Component {
  static propTypes = {
    event: PropTypes.object.isRequired,
    group: PropTypes.object.isRequired,
    type: PropTypes.string.isRequired,
    alias: PropTypes.string.isRequired,
    value: PropTypes.object.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isLoading: false,
    };
  }

  componentWillMount() {
    this.syncPlugin();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.group.id != this.props.group.id || prevProps.type != this.props.type) {
      this.syncPlugin();
    }
  }

  syncPlugin = () => {
    let sourcePlugin = getSourcePlugin(this.props.group.pluginContexts, this.props.type);
    if (!sourcePlugin) {
      this.setState({
        pluginLoading: false,
      });
    } else {
      this.setState(
        {
          pluginLoading: true,
        },
        () => {
          plugins.load(sourcePlugin, () => {
            this.setState({pluginLoading: false});
          });
        }
      );
    }
  };

  renderTitle = component => {
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
  };

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
        title={this.renderTitle(Component)}
      >
        <Component alias={alias} data={value} />
      </GroupEventDataSection>
    );
  }
}

class ContextsInterface extends React.Component {
  static propTypes = {
    event: PropTypes.object.isRequired,
    group: PropTypes.object.isRequired,
  };

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
}

export default ContextsInterface;
