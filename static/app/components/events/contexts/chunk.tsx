import {Fragment, useCallback, useEffect, useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import plugins from 'sentry/plugins';
import {Group} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined, toTitleCase} from 'sentry/utils';

import {getContextComponent, getSourcePlugin} from './utils';

type Props = {
  alias: string;
  event: Event;
  type: string;
  group?: Group;
  value?: Record<string, any>;
};

function getTitle({value = {}, alias, type}: Pick<Props, 'alias' | 'type' | 'value'>) {
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
    case 'otel':
      return t('OpenTelemetry');
    case 'unity':
      return t('Unity');
    case 'memory_info': // Future new value for memory info
    case 'Memory Info': // Current value for memory info
      return t('Memory Info');
    case 'threadpool_info': // Future new value for thread pool info
    case 'ThreadPool Info': // Current value for thread pool info
      return t('Thread Pool Info');
    case 'default':
      if (alias === 'state') {
        return t('Application State');
      }
      return toTitleCase(alias);
    default:
      return toTitleCase(type);
  }
}

export function Chunk({group, type, alias, value = {}, event}: Props) {
  const [pluginLoading, setPluginLoading] = useState(false);

  const syncPlugin = useCallback(() => {
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
      setPluginLoading(false);
      return;
    }

    setPluginLoading(true);

    plugins.load(sourcePlugin, () => {
      setPluginLoading(false);
    });
  }, [alias, type, group]);

  useEffect(() => {
    syncPlugin();
  }, [type, group?.id, syncPlugin]);

  // if we are currently loading the plugin, just render nothing for now.
  if (pluginLoading) {
    return null;
  }

  // we intentionally hide reprocessing context to not imply it was sent by the SDK.
  if (alias === 'reprocessing') {
    return null;
  }

  const ContextComponent =
    type === 'default'
      ? getContextComponent(alias) || getContextComponent(type)
      : getContextComponent(type);

  const isObjectValueEmpty = Object.values(value).filter(v => defined(v)).length === 0;

  // this can happen if the component does not exist
  if (!ContextComponent || isObjectValueEmpty) {
    return null;
  }

  return (
    <EventDataSection
      key={`context-${alias}`}
      type={`context-${alias}`}
      title={
        <Fragment>
          {getTitle({value, alias, type})}
          {defined(type) && type !== 'default' && alias !== type && (
            <small>({alias})</small>
          )}
        </Fragment>
      }
    >
      <ContextComponent alias={alias} event={event} data={value} />
    </EventDataSection>
  );
}
