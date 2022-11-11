import {Fragment} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import ContextData from 'sentry/components/contextData';
import {t} from 'sentry/locale';
import plugins from 'sentry/plugins';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import type {Event, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';

const CONTEXT_TYPES = {
  default: require('sentry/components/events/contexts/default').default,
  app: require('sentry/components/events/contexts/app').AppEventContext,
  device: require('sentry/components/events/contexts/device').DeviceEventContext,
  browser: require('sentry/components/events/contexts/browser').BrowserEventContext,
  os: require('sentry/components/events/contexts/operatingSystem')
    .OperatingSystemEventContext,
  runtime: require('sentry/components/events/contexts/runtime').RuntimeEventContext,
  user: require('sentry/components/events/contexts/user').UserEventContext,
  gpu: require('sentry/components/events/contexts/gpu').GPUEventContext,
  trace: require('sentry/components/events/contexts/trace').TraceEventContext,
  // 'redux.state' will be replaced with more generic context called 'state'
  'redux.state': require('sentry/components/events/contexts/redux').default,
  state: require('sentry/components/events/contexts/state').StateEventContext,
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

export function geKnownData<Data, DataType>({
  data,
  knownDataTypes,
  meta,
  raw,
  onGetKnownDataDetails,
}: {
  data: Data;
  knownDataTypes: string[];
  onGetKnownDataDetails: (props: {data: Data; type: DataType}) =>
    | {
        subject: string;
        value?: React.ReactNode;
      }
    | undefined;
  meta?: Record<any, any>;
  raw?: boolean;
}): KeyValueListData {
  const filteredTypes = knownDataTypes.filter(knownDataType => {
    if (
      typeof data[knownDataType] !== 'number' &&
      typeof data[knownDataType] !== 'boolean' &&
      !data[knownDataType]
    ) {
      return !!meta?.[knownDataType];
    }
    return true;
  });

  return filteredTypes
    .map(type => {
      const knownDataDetails = onGetKnownDataDetails({
        data,
        type: type as unknown as DataType,
      });

      if (!knownDataDetails) {
        return null;
      }

      return {
        key: type,
        ...knownDataDetails,
        value: raw ? (
          knownDataDetails.value
        ) : (
          <ContextData
            data={knownDataDetails.value}
            meta={meta?.[type]}
            withAnnotatedText
          />
        ),
      };
    })
    .filter(defined);
}

export function getUnknownData({
  allData,
  knownKeys,
  meta,
}: {
  allData: Record<string, any>;
  knownKeys: string[];
  meta?: NonNullable<Event['_meta']>[keyof Event['_meta']];
}): KeyValueListData {
  return Object.entries(allData)
    .filter(
      ([key]) =>
        key !== 'type' &&
        key !== 'title' &&
        !knownKeys.includes(key) &&
        (typeof allData[key] !== 'number' && !allData[key] ? !!meta?.[key]?.[''] : true)
    )
    .map(([key, value]) => ({
      key,
      value,
      subject: startCase(key),
      meta: meta?.[key]?.[''],
    }));
}

const RelativeTime = styled('span')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;
