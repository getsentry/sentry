import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {t} from 'app/locale';
import plugins from 'app/plugins';
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
  timestamp?: string
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

  return (
    <React.Fragment>
      {timestamp}
      <RelativeTime>{relativeTime}</RelativeTime>
    </React.Fragment>
  );
}

const RelativeTime = styled('span')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.25)};
`;
