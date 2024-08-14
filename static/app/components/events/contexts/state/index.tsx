import upperFirst from 'lodash/upperFirst';

import ClippedBox from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {getContextMeta} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {KeyValueListData, KeyValueListDataItem} from 'sentry/types/group';

type StateDescription = {
  value: Record<string, any> | null | string;
  type?: string;
};

type Props = {
  data: {
    [state: string]: StateDescription;
    state: StateDescription;
  };
  event: Event;
  meta?: Record<string, any>;
};

function getStateTitle(name: string, type?: string) {
  return `${name}${type ? ` (${upperFirst(type)})` : ''}`;
}

export function getKnownStateContextData({
  data,
  meta,
}: Pick<Props, 'data' | 'meta'>): KeyValueListData {
  if (!data.state) {
    return [];
  }

  return [
    {
      key: 'state',
      subject: getStateTitle(t('State'), data.state.type),
      // TODO(TS): Objects cannot be rendered to dom
      value: data.state.value as string,
      meta: meta?.state?.value?.[''],
    },
  ];
}

export function getUnknownStateContextData({
  data,
  meta = {},
}: Pick<Props, 'data' | 'meta'>): KeyValueListData {
  return Object.entries(data)
    .filter(([key]) => !['type', 'title', 'state'].includes(key))
    .map<KeyValueListDataItem>(([name, state]) => ({
      key: name,
      // TODO(TS): Objects cannot be rendered to dom
      value: state.value as string,
      subject: getStateTitle(name, state.type),
      meta: meta[name]?.value?.[''],
    }));
}

export function StateEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'state');
  const knownData = getKnownStateContextData({data, meta});
  const unknownData = getUnknownStateContextData({data, meta});
  return (
    <ClippedBox clipHeight={250}>
      <ContextBlock data={knownData} />
      <ContextBlock data={unknownData} />
    </ClippedBox>
  );
}
