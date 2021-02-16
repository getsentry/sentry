import React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import {t} from 'app/locale';
import plugins from 'app/plugins';
import {Group} from 'app/types';
import {Event} from 'app/types/event';
import {defined, toTitleCase} from 'app/utils';

import {getContextComponent, getSourcePlugin} from './utils';

type Props = {
  alias: string;
  event: Event;
  type: string;
  value?: Record<string, any>;
  group?: Group;
};

type State = {
  isLoading: boolean;
  pluginLoading?: boolean;
};

class Chunk extends React.Component<Props, State> {
  state: State = {
    isLoading: false,
  };

  UNSAFE_componentWillMount() {
    this.syncPlugin();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.type !== this.props.type ||
      prevProps.group?.id !== this.props.group?.id
    ) {
      this.syncPlugin();
    }
  }

  syncPlugin() {
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
      this.setState({pluginLoading: false});
      return;
    }

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

  getTitle() {
    const {value = {}, alias, type} = this.props;

    if (defined(value.title) && typeof value.title !== 'object') {
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
  }

  render() {
    const {pluginLoading} = this.state;

    // if we are currently loading the plugin, just render nothing for now.
    if (pluginLoading) {
      return null;
    }

    const {type, alias, value = {}, event} = this.props;

    // we intentionally hide reprocessing context to not imply it was sent by the SDK.
    if (alias === 'reprocessing') {
      return null;
    }

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
        key={`context-${alias}`}
        type={`context-${alias}`}
        title={
          <React.Fragment>
            {this.getTitle()}
            {defined(type) && type !== 'default' && alias !== type && (
              <small>({alias})</small>
            )}
          </React.Fragment>
        }
      >
        <Component alias={alias} event={event} data={value} />
      </EventDataSection>
    );
  }
}

export default Chunk;
