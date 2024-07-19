import {Fragment, useCallback, useEffect, useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import plugins from 'sentry/plugins';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';

import {
  getContextComponent,
  getContextMeta,
  getContextTitle,
  getSourcePlugin,
} from './utils';

type Props = {
  alias: string;
  event: Event;
  type: string;
  group?: Group;
  value?: Record<string, any>;
};
/**
 * @deprecated Legacy design, use ContextCard instead
 */
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
          {getContextTitle({value, alias, type})}
          {defined(type) && type !== 'default' && alias !== type && (
            <small>({alias})</small>
          )}
        </Fragment>
      }
    >
      <ContextComponent
        alias={alias}
        event={event}
        data={value}
        meta={getContextMeta(event, type)}
      />
    </EventDataSection>
  );
}
