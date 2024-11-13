import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import moment from 'moment-timezone';
import logoUnknown from 'sentry-logos/logo-unknown.svg';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {DeviceName} from 'sentry/components/deviceName';
import {
  ContextIcon,
  type ContextIconProps,
  getLogoImage,
} from 'sentry/components/events/contexts/contextIcon';
import {getAppContextData} from 'sentry/components/events/contexts/knownContext/app';
import {getBrowserContextData} from 'sentry/components/events/contexts/knownContext/browser';
import {getCloudResourceContextData} from 'sentry/components/events/contexts/knownContext/cloudResource';
import {getCultureContextData} from 'sentry/components/events/contexts/knownContext/culture';
import {getGPUContextData} from 'sentry/components/events/contexts/knownContext/gpu';
import {getMemoryInfoContext} from 'sentry/components/events/contexts/knownContext/memoryInfo';
import {getMissingInstrumentationContextData} from 'sentry/components/events/contexts/knownContext/missingInstrumentation';
import {getOperatingSystemContextData} from 'sentry/components/events/contexts/knownContext/os';
import {userContextToActor} from 'sentry/components/events/interfaces/utils';
import StructuredEventData from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {KeyValueListData, KeyValueListDataItem} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import commonTheme from 'sentry/utils/theme';

import {getDefaultContextData} from './default';
import {getKnownDeviceContextData, getUnknownDeviceContextData} from './device';
import {
  getKnownPlatformContextData,
  getPlatformContextIcon,
  getUnknownPlatformContextData,
  KNOWN_PLATFORM_CONTEXTS,
} from './platform';
import {getKnownProfileContextData, getUnknownProfileContextData} from './profile';
import {getReduxContextData} from './redux';
import {getKnownReplayContextData, getUnknownReplayContextData} from './replay';
import {getKnownRuntimeContextData, getUnknownRuntimeContextData} from './runtime';
import {getKnownStateContextData, getUnknownStateContextData} from './state';
import {
  getKnownThreadPoolInfoContextData,
  getUnknownThreadPoolInfoContextData,
} from './threadPoolInfo';
import {getKnownTraceContextData, getUnknownTraceContextData} from './trace';
import {getKnownUnityContextData, getUnknownUnityContextData} from './unity';
import {getKnownUserContextData, getUnknownUserContextData} from './user';

/**
 * Generates the class name used for contexts
 */
export function generateIconName(
  name?: string | boolean | null,
  version?: string
): string {
  if (!defined(name) || typeof name === 'boolean') {
    return '';
  }

  const lowerCaseName = name.toLowerCase();

  // amazon fire tv device id changes with version: AFTT, AFTN, AFTS, AFTA, AFTVA (alexa), ...
  if (lowerCaseName.startsWith('aft')) {
    return 'amazon';
  }

  if (lowerCaseName.startsWith('sm-') || lowerCaseName.startsWith('st-')) {
    return 'samsung';
  }

  if (lowerCaseName.startsWith('moto')) {
    return 'motorola';
  }

  if (lowerCaseName.startsWith('pixel')) {
    return 'google';
  }

  const formattedName = name
    .split(/\d/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/\-+$/, '')
    .replace(/^\-+/, '');

  if (formattedName === 'edge' && version) {
    const majorVersion = version.split('.')[0];
    const isLegacyEdge = majorVersion >= '12' && majorVersion <= '18';

    return isLegacyEdge ? 'legacy-edge' : 'edge';
  }

  if (formattedName.endsWith('-mobile')) {
    return formattedName.split('-')[0];
  }

  return formattedName;
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

export type KnownDataDetails = Omit<KeyValueListDataItem, 'key'> | undefined;

export function getKnownData<Data, DataType>({
  data,
  knownDataTypes,
  onGetKnownDataDetails,
  meta,
}: {
  data: Data;
  knownDataTypes: string[];
  onGetKnownDataDetails: (props: {data: Data; type: DataType}) => KnownDataDetails;
  meta?: Record<any, any>;
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
        value: knownDataDetails.value,
      };
    })
    .filter(defined);
}

export function getKnownStructuredData(
  knownData: KeyValueListData,
  meta: Record<string, any>
): KeyValueListData {
  return knownData.map(kd => ({
    ...kd,
    value: (
      <StructuredEventData data={kd.value} meta={meta?.[kd.key]} withAnnotatedText />
    ),
  }));
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
      subject: key,
      meta: meta?.[key]?.[''],
    }));
}

/**
 * Returns the type of a given context, after coercing from its type and alias.
 * - 'type' refers the the `type` key on it's data blob. This is usually overridden by the SDK for known types, but not always.
 * - 'alias' refers to the key on event.contexts. This can be set by the user, but we have to depend on it for some contexts.
 */
export function getContextType({alias, type}: {alias: string; type?: string}): string {
  if (!defined(type)) {
    return alias;
  }
  return type === 'default' ? alias : type;
}

/**
 * Omit certain keys from ever being displayed on context items.
 * All custom context (and some known context) has the type:default so we remove it.
 */
export function getContextKeys({
  data,
  hiddenKeys = [],
}: {
  data: Record<string, any>;
  hiddenKeys?: string[];
}): string[] {
  const hiddenKeySet = new Set(hiddenKeys);
  return Object.keys(data).filter(
    ctxKey => ctxKey !== 'type' && !hiddenKeySet.has(ctxKey)
  );
}

export function getContextTitle({
  alias,
  type,
  value = {},
}: {
  alias: string;
  type: string;
  value?: Record<string, any>;
}) {
  if (defined(value.title) && typeof value.title !== 'object') {
    return value.title;
  }

  const contextType = getContextType({alias, type});

  switch (contextType) {
    case 'app':
      return t('App');
    case 'device':
      return t('Device');
    case 'browser':
      return t('Browser');
    case 'response':
      return t('Response');
    case 'feedback':
      return t('Feedback');
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
      return 'OpenTelemetry';
    case 'cloud_resource':
      return t('Cloud Resource');
    case 'culture':
    case 'Current Culture':
      return t('Culture');
    case 'missing_instrumentation':
      return t('Missing OTEL Instrumentation');
    case 'unity':
      return 'Unity';
    case 'memory_info': // Current value for memory info
    case 'Memory Info': // Legacy for memory info
      return t('Memory Info');
    case 'threadpool_info': // Current value for thread pool info
    case 'ThreadPool Info': // Legacy value for thread pool info
      return t('Thread Pool Info');
    case 'state':
      return t('Application State');
    case 'laravel':
      return t('Laravel Context');
    case 'profile':
      return t('Profile');
    case 'replay':
      return t('Replay');
    default:
      return contextType;
  }
}

export function getContextMeta(event: Event, contextType: string): Record<string, any> {
  const defaultMeta = event._meta?.contexts?.[contextType] ?? {};
  switch (contextType) {
    case 'memory_info': // Current
    case 'Memory Info': // Legacy
      return event._meta?.contexts?.['Memory Info'] ?? defaultMeta;
    case 'threadpool_info': // Current
    case 'ThreadPool Info': // Legacy
      return event._meta?.contexts?.['ThreadPool Info'] ?? defaultMeta;
    case 'user':
      return event._meta?.user ?? defaultMeta;
    default:
      return defaultMeta;
  }
}

export function getContextIcon({
  alias,
  type,
  value = {},
  contextIconProps = {},
}: {
  alias: string;
  type: string;
  contextIconProps?: Partial<ContextIconProps>;
  value?: Record<string, any>;
}): React.ReactNode {
  if (KNOWN_PLATFORM_CONTEXTS.has(alias)) {
    return getPlatformContextIcon({
      platform: alias,
      size: contextIconProps?.size ?? 'xl',
    });
  }
  let iconName = '';
  switch (type) {
    case 'device':
      iconName = generateIconName(value?.model);
      break;
    case 'client_os':
    case 'os':
      iconName = generateIconName(value?.name);
      break;
    case 'runtime':
    case 'browser':
      iconName = generateIconName(value?.name, value?.version);
      break;
    case 'user':
      const user = userContextToActor(value);
      const iconSize = commonTheme.iconNumberSizes[contextIconProps?.size ?? 'xl'];
      return <UserAvatar user={user as AvatarUser} size={iconSize} gravatar={false} />;
    case 'gpu':
      iconName = generateIconName(value?.vendor_name ? value?.vendor_name : value?.name);
      break;
    default:
      break;
  }
  if (iconName.length === 0) {
    return null;
  }

  const imageName = getLogoImage(iconName);
  if (imageName === logoUnknown) {
    return null;
  }
  return <ContextIcon name={iconName} {...contextIconProps} />;
}

export function getFormattedContextData({
  event,
  contextType,
  contextValue,
  organization,
  project,
  location,
}: {
  contextType: string;
  contextValue: any;
  event: Event;
  location: Location;
  organization: Organization;
  project?: Project;
}): KeyValueListData {
  const meta = getContextMeta(event, contextType);

  if (KNOWN_PLATFORM_CONTEXTS.has(contextType)) {
    return [
      ...getKnownPlatformContextData({platform: contextType, data: contextValue, meta}),
      ...getUnknownPlatformContextData({platform: contextType, data: contextValue, meta}),
    ];
  }

  switch (contextType) {
    case 'app':
      return getAppContextData({data: contextValue, event, meta});
    case 'device':
      return [
        ...getKnownDeviceContextData({data: contextValue, event, meta}),
        ...getUnknownDeviceContextData({data: contextValue, meta}),
      ];
    case 'memory_info': // Current
    case 'Memory Info': // Legacy
      return getMemoryInfoContext({data: contextValue, meta});
    case 'browser':
      return getBrowserContextData({data: contextValue, meta});
    case 'os':
      return getOperatingSystemContextData({data: contextValue, meta});
    case 'unity':
      return [
        ...getKnownUnityContextData({data: contextValue, meta}),
        ...getUnknownUnityContextData({data: contextValue, meta}),
      ];
    case 'runtime':
      return [
        ...getKnownRuntimeContextData({data: contextValue, meta}),
        ...getUnknownRuntimeContextData({data: contextValue, meta}),
      ];
    case 'user':
      return [
        ...getKnownUserContextData({data: contextValue, meta}),
        ...getUnknownUserContextData({data: contextValue, meta}),
      ];
    case 'gpu':
      return getGPUContextData({data: contextValue, meta});
    case 'trace':
      return [
        ...getKnownTraceContextData({
          data: contextValue,
          event,
          meta,
          organization,
          location,
        }),
        ...getUnknownTraceContextData({data: contextValue, meta}),
      ];
    case 'threadpool_info': // Current
    case 'ThreadPool Info': // Legacy
      return [
        ...getKnownThreadPoolInfoContextData({data: contextValue, event, meta}),
        ...getUnknownThreadPoolInfoContextData({data: contextValue, meta}),
      ];
    case 'redux.state':
      return getReduxContextData({data: contextValue});
    case 'state':
      return [
        ...getKnownStateContextData({data: contextValue, meta}),
        ...getUnknownStateContextData({data: contextValue, meta}),
      ];
    case 'profile':
      return [
        ...getKnownProfileContextData({data: contextValue, meta, organization, project}),
        ...getUnknownProfileContextData({data: contextValue, meta}),
      ];
    case 'replay':
      return [
        ...getKnownReplayContextData({data: contextValue, meta, organization}),
        ...getUnknownReplayContextData({data: contextValue, meta}),
      ];
    case 'cloud_resource':
      return getCloudResourceContextData({data: contextValue, meta});
    case 'culture':
    case 'Current Culture':
      return getCultureContextData({data: contextValue, meta});
    case 'missing_instrumentation':
      return getMissingInstrumentationContextData({data: contextValue, meta});
    default:
      return getDefaultContextData(contextValue);
  }
}
/**
 * Reimplemented as util function from legacy summaries deleted in this PR - https://github.com/getsentry/sentry/pull/71695/files
 * Consildated into one function and neglects any meta annotations since those will be rendered in the proper contexts section.
 * The only difference is we don't render 'unknown' values, since that doesn't help the user.
 */
export function getContextSummary({
  type,
  value: data,
}: {
  type: string;
  value?: Record<string, any>;
}): {
  subtitle: React.ReactNode;
  title: React.ReactNode;
  subtitleType?: string;
} {
  let title: React.ReactNode = null;
  let subtitle: React.ReactNode = null;
  let subtitleType: string | undefined = undefined;
  switch (type) {
    case 'device':
      title = (
        <DeviceName value={data?.model ?? ''}>
          {deviceName => <span>{deviceName ? deviceName : data?.name}</span>}
        </DeviceName>
      );
      if (defined(data?.arch)) {
        subtitle = data?.arch;
        subtitleType = t('Architecture');
      } else if (defined(data?.model)) {
        subtitle = data?.model;
        subtitleType = t('Model');
      }
      break;

    case 'gpu':
      title = data?.name ?? null;
      if (defined(data?.vendor_name)) {
        subtitle = data?.vendor_name;
        subtitleType = t('Vendor');
      }
      break;

    case 'os':
    case 'client_os':
      title = data?.name ?? null;
      if (defined(data?.version) && typeof data?.version === 'string') {
        subtitle = data?.version;
        subtitleType = t('Version');
      } else if (defined(data?.kernel_version)) {
        subtitle = data?.kernel_version;
        subtitleType = t('Kernel');
      }
      break;

    case 'user':
      if (defined(data?.email)) {
        title = data?.email;
      }
      if (defined(data?.ip_address) && !title) {
        title = data?.ip_address;
      }
      if (defined(data?.id)) {
        title = title ? title : data?.id;
        subtitle = data?.id;
        subtitleType = t('ID');
      }
      if (defined(data?.username)) {
        title = title ? title : data?.username;
        subtitle = data?.username;
        subtitleType = t('Username');
      }
      if (title === subtitle) {
        return {
          title,
          subtitle: null,
        };
      }
      break;
    case 'runtime':
    case 'browser':
      title = data?.name ?? null;
      if (defined(data?.version)) {
        subtitle = data?.version;
        subtitleType = t('Version');
      }
      break;
    default:
      break;
  }
  return {
    title,
    subtitle,
    subtitleType,
  };
}

const RelativeTime = styled('span')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;

export const CONTEXT_DOCS_LINK = `https://docs.sentry.io/platform-redirect/?next=/enriching-events/context/`;
