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
import {removeFilterMaskedEntries} from 'sentry/components/events/interfaces/utils';
import StructuredEventData from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import plugins from 'sentry/plugins';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {KeyValueListData, KeyValueListDataItem} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import commonTheme from 'sentry/utils/theme';

import {AppEventContext, getKnownAppContextData, getUnknownAppContextData} from './app';
import {
  BrowserEventContext,
  getKnownBrowserContextData,
  getUnknownBrowserContextData,
} from './browser';
import {DefaultContext, getDefaultContextData} from './default';
import {
  DeviceEventContext,
  getKnownDeviceContextData,
  getUnknownDeviceContextData,
} from './device';
import {getKnownGpuContextData, getUnknownGpuContextData, GPUEventContext} from './gpu';
import {
  getKnownMemoryInfoContextData,
  getUnknownMemoryInfoContextData,
  MemoryInfoEventContext,
} from './memoryInfo';
import {
  getKnownOperatingSystemContextData,
  getUnknownOperatingSystemContextData,
  OperatingSystemEventContext,
} from './operatingSystem';
import {
  getKnownPlatformContextData,
  getPlatformContextIcon,
  getUnknownPlatformContextData,
  KNOWN_PLATFORM_CONTEXTS,
} from './platform';
import {
  getKnownProfileContextData,
  getUnknownProfileContextData,
  ProfileEventContext,
} from './profile';
import {getReduxContextData, ReduxContext} from './redux';
import {
  getKnownReplayContextData,
  getUnknownReplayContextData,
  ReplayEventContext,
} from './replay';
import {
  getKnownRuntimeContextData,
  getUnknownRuntimeContextData,
  RuntimeEventContext,
} from './runtime';
import {
  getKnownStateContextData,
  getUnknownStateContextData,
  StateEventContext,
} from './state';
import {
  getKnownThreadPoolInfoContextData,
  getUnknownThreadPoolInfoContextData,
  ThreadPoolInfoEventContext,
} from './threadPoolInfo';
import {
  getKnownTraceContextData,
  getUnknownTraceContextData,
  TraceEventContext,
} from './trace';
import {
  getKnownUnityContextData,
  getUnknownUnityContextData,
  UnityEventContext,
} from './unity';
import {
  getKnownUserContextData,
  getUnknownUserContextData,
  UserEventContext,
} from './user';

const CONTEXT_TYPES = {
  default: DefaultContext,
  app: AppEventContext,
  device: DeviceEventContext,
  memory_info: MemoryInfoEventContext,
  browser: BrowserEventContext,
  os: OperatingSystemEventContext,
  unity: UnityEventContext,
  runtime: RuntimeEventContext,
  user: UserEventContext,
  gpu: GPUEventContext,
  trace: TraceEventContext,
  threadpool_info: ThreadPoolInfoEventContext,
  state: StateEventContext,
  profile: ProfileEventContext,
  replay: ReplayEventContext,
  // 'redux.state' will be replaced with more generic context called 'state'
  'redux.state': ReduxContext,
  // 'ThreadPool Info' will be replaced with 'threadpool_info' but
  // we want to keep it here for now so it works for existing versions
  'ThreadPool Info': ThreadPoolInfoEventContext,
  // 'Memory Info' will be replaced with 'memory_info' but
  // we want to keep it here for now so it works for existing versions
  'Memory Info': MemoryInfoEventContext,
};

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

  if (!defined(type)) {
    return alias;
  }

  switch (type) {
    case 'app':
      return t('App');
    case 'device':
      return t('Device');
    case 'browser':
      return t('Browser');
    case 'profile':
      return t('Profile');
    case 'replay':
      return t('Replay');
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
    case 'unity':
      return 'Unity';
    case 'memory_info': // Current value for memory info
    case 'Memory Info': // Legacy for memory info
      return t('Memory Info');
    case 'threadpool_info': // Current value for thread pool info
    case 'ThreadPool Info': // Legacy value for thread pool info
      return t('Thread Pool Info');
    case 'default':
      switch (alias) {
        case 'state':
          return t('Application State');
        case 'laravel':
          return t('Laravel Context');
        case 'profile':
          return t('Profile');
        case 'replay':
          return t('Replay');
        default:
          return alias;
      }
    default:
      return type;
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
      const user = removeFilterMaskedEntries(value);
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
      return [
        ...getKnownAppContextData({data: contextValue, event, meta}),
        ...getUnknownAppContextData({data: contextValue, meta}),
      ];
    case 'device':
      return [
        ...getKnownDeviceContextData({data: contextValue, event, meta}),
        ...getUnknownDeviceContextData({data: contextValue, meta}),
      ];
    case 'memory_info': // Current
    case 'Memory Info': // Legacy
      return [
        ...getKnownMemoryInfoContextData({data: contextValue, event, meta}),
        ...getUnknownMemoryInfoContextData({data: contextValue, meta}),
      ];
    case 'browser':
      return [
        ...getKnownBrowserContextData({data: contextValue, meta}),
        ...getUnknownBrowserContextData({data: contextValue, meta}),
      ];
    case 'os':
      return [
        ...getKnownOperatingSystemContextData({data: contextValue, meta}),
        ...getUnknownOperatingSystemContextData({data: contextValue, meta}),
      ];
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
      return [
        ...getKnownGpuContextData({data: contextValue, meta}),
        ...getUnknownGpuContextData({data: contextValue, meta}),
      ];
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
} {
  let title: React.ReactNode = null;
  let subtitle: React.ReactNode = null;
  switch (type) {
    case 'device':
      title = (
        <DeviceName value={data?.model ?? ''}>
          {deviceName => <span>{deviceName ? deviceName : data?.name}</span>}
        </DeviceName>
      );
      if (defined(data?.arch)) {
        subtitle = t('Arch: ') + data?.arch;
      } else if (defined(data?.model)) {
        subtitle = t('Model: ') + data?.model;
      }
      break;

    case 'gpu':
      title = data?.name ?? null;
      if (defined(data?.vendor_name)) {
        subtitle = t('Vendor: ') + data?.vendor_name;
      }
      break;

    case 'os':
    case 'client_os':
      title = data?.name ?? null;
      if (defined(data?.version) && typeof data?.version === 'string') {
        subtitle = t('Version: ') + data?.version;
      } else if (defined(data?.kernel_version)) {
        subtitle = t('Kernel: ') + data?.kernel_version;
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
        subtitle = t('ID: ') + data?.id;
      }
      if (defined(data?.username)) {
        title = title ? title : data?.username;
        subtitle = t('Username: ') + data?.username;
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
        subtitle = t('Version: ') + data?.version;
      }
      break;
    default:
      break;
  }
  return {
    title,
    subtitle,
  };
}

const RelativeTime = styled('span')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;

export const CONTEXT_DOCS_LINK = `https://docs.sentry.io/platform-redirect/?next=/enriching-events/context/`;
