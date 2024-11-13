import upperFirst from 'lodash/upperFirst';

import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum StateContextKeys {
  STATE = 'state',
}

export interface StateContext {
  // Any custom keys users may set
  [key: string]: any;
  [StateContextKeys.STATE]: Record<string, any>;
}

export function getStateContextData({
  data,
  meta,
}: {
  data: StateContext;
  meta?: Record<keyof StateContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case StateContextKeys.STATE:
        return {
          key: ctxKey,
          subject: `${t('State')}${data.state.type ? ` (${upperFirst(data.state.type)})` : ''}`,
          // TODO(TS): Objects cannot be rendered to dom
          value: data.state.value as string,
          meta: meta?.state?.value?.[''],
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
