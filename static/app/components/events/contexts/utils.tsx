import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {t} from 'app/locale';
import plugins from 'app/plugins';
import ConfigStore from 'app/stores/configStore';
import space from 'app/styles/space';
import {defined} from 'app/utils';

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

export function getContextComponent(type: string) {
  return CONTEXT_TYPES[type] || plugins.contexts[type] || CONTEXT_TYPES.default;
}

export function getSourcePlugin(pluginContexts: Array<any>, contextType: string) {
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

export function getRelativeTimeFromEventDateCreated(
  eventDateCreated: string,
  timestamp?: string,
  showTimestamp = true
) {
  if (!defined(timestamp)) {
    return timestamp;
  }

  const dateTime = moment(timestamp);

  if (!dateTime.isValid()) {
    return timestamp;
  }

  const relativeTime = `(${dateTime.from(eventDateCreated, true)} ${t(
    'before this event'
  )})`;

  if (!showTimestamp) {
    return <RelativeTime>{relativeTime}</RelativeTime>;
  }

  return (
    <Fragment>
      {timestamp}
      <RelativeTime>{relativeTime}</RelativeTime>
    </Fragment>
  );
}

// Typescript doesn't have types for DisplayNames yet and that's why the type assertion "any" is needed below.
// There is currently an open PR that intends to introduce the types https://github.com/microsoft/TypeScript/pull/44022
export function getFullLanguageDescription(locale: string) {
  const sentryAppLanguageCode = ConfigStore.get('languageCode');

  const [languageAbbreviation, countryAbbreviation] = locale.includes('_')
    ? locale.split('_')
    : locale.split('-');

  try {
    const languageNames = new (Intl as any).DisplayNames(sentryAppLanguageCode, {
      type: 'language',
    });

    const languageName = languageNames.of(languageAbbreviation);

    if (countryAbbreviation) {
      const regionNames = new (Intl as any).DisplayNames(sentryAppLanguageCode, {
        type: 'region',
      });

      const countryName = regionNames.of(countryAbbreviation.toUpperCase());

      return `${languageName} (${countryName})`;
    }

    return languageName;
  } catch {
    return locale;
  }
}

const RelativeTime = styled('span')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;
