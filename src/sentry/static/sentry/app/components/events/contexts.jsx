import PropTypes from 'prop-types';
import * as React from 'react';

import {objectIsEmpty, toTitleCase, defined} from 'app/utils';
import EventDataSection from 'app/components/events/eventDataSection';
import plugins from 'app/plugins';
import {t} from 'app/locale';

const CONTEXT_TYPES = {
  default: require('app/components/events/contexts/default').default,
  app: require('app/components/events/contexts/app/app').default,
  device: require('app/components/events/contexts/device/device').default,
  os: require('app/components/events/contexts/operatingSystem/operatingSystem').default,
  runtime: require('app/components/events/contexts/runtime/runtime').default,
  user: require('app/components/events/contexts/user/user').default,
  gpu: require('app/components/events/contexts/gpu/gpu').default,
  trace: require('app/components/events/contexts/trace/trace').default,
  // 'redux.state' will be replaced with more generic context called 'state'
  'redux.state': require('app/components/events/contexts/redux').default,
  state: require('app/components/events/contexts/state').default,
};

function getContextComponent(type) {
  return CONTEXT_TYPES[type] || plugins.contexts[type] || CONTEXT_TYPES.default;
}

function getSourcePlugin(pluginContexts, contextType) {
  if (CONTEXT_TYPES[contextType]) {
    return null;
  }
  for (const plugin of pluginContexts) {
    if (plugin.contexts.indexOf(contextType) >= 0) {
      return plugin;
    }
  }
  return null;
}

class ContextChunk extends React.Component {
  static propTypes = {
    event: PropTypes.object.isRequired,
    group: PropTypes.object,
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

  UNSAFE_componentWillMount() {
    this.syncPlugin();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.type !== this.props.type ||
      prevProps?.group?.id !== this.props?.group?.id
    ) {
      this.syncPlugin();
    }
  }

  syncPlugin = () => {
    const {group, type, alias} = this.props;
    // If we don't have a grouped event we can't sync with plugins.
    if (!group) {
      return;
    }

    // Search using `alias` first because old plugins rely on it and type is set to "default"
    // e.g. sessionstack
    const sourcePlugin =
      type === 'default'
        ? getSourcePlugin(group.pluginContexts, alias) ||
          getSourcePlugin(group.pluginContexts, type)
        : getSourcePlugin(group.pluginContexts, type);

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

  getTitle = () => {
    const {value, alias, type} = this.props;

    if (defined(value.title)) {
      return value.title;
    }

    if (!defined(type)) {
      return toTitleCase(alias);
    }

    switch (type) {
      case 'app':
        return t('App');
      case 'device':
        return t('Device');
      case 'os':
        return t('Operating System');
      case 'user':
        return t('User');
      case 'gpu':
        return t('Graphics Processing Unit');
      case 'runtime':
        return t('Runtime');
      case 'trace':
        return t('Trace Details');
      case 'default':
        if (alias === 'state') return t('Application State');
        return toTitleCase(alias);
      default:
        return toTitleCase(type);
    }
  };

  renderSectionTitle = () => {
    const {alias, type} = this.props;
    return (
      <React.Fragment>
        {this.getTitle()}
        {defined(type) && type !== 'default' && alias !== type && (
          <small>({alias})</small>
        )}
      </React.Fragment>
    );
  };

  render() {
    // if we are currently loading the plugin, just render nothing for now.
    if (this.state.pluginLoading) {
      return null;
    }

    const evt = this.props.event;
    const {type, alias, value = {}} = this.props;
    const Component =
      type === 'default'
        ? getContextComponent(alias) || getContextComponent(type)
        : getContextComponent(type);

    const isObjectValueEmpty = Object.values(value).filter(v => defined(v)).length === 0;

    // this can happen if the component does not exist
    if (!Component || isObjectValueEmpty) {
      return null;
    }

    return (
      <EventDataSection
        event={evt}
        key={`context-${alias}`}
        type={`context-${alias}`}
        title={this.renderSectionTitle()}
      >
        <Component alias={alias} event={evt} data={value} />
      </EventDataSection>
    );
  }
}

class ContextsInterface extends React.Component {
  static propTypes = {
    event: PropTypes.object.isRequired,
    group: PropTypes.object,
  };

  render() {
    const group = this.props.group;
    const evt = this.props.event;
    const children = [];
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
    for (const key in evt.contexts) {
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

    return <React.Fragment>{children}</React.Fragment>;
  }
}

export default ContextsInterface;
