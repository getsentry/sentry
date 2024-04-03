import upperFirst from 'lodash/upperFirst';

import ClippedBox from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {t} from 'sentry/locale';
import type {Event, KeyValueListData, KeyValueListDataItem} from 'sentry/types';

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
};

export function StateEventContext({data, event}: Props) {
  const meta = event._meta?.contexts?.state ?? {};

  function getStateTitle(name: string, type?: string) {
    return `${name}${type ? ` (${upperFirst(type)})` : ''}`;
  }

  function getKnownData(): KeyValueListData {
    if (!data.state) {
      return [];
    }

    return [
      {
        key: 'state',
        subject: getStateTitle(t('State'), data.state.type),
        // TODO(TS): Objects cannot be rendered to dom
        value: data.state.value as string,
        meta: meta.state?.value?.[''],
      },
    ];
  }

  function getUnknownData(): KeyValueListData {
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

  return (
    <ClippedBox clipHeight={250}>
      <ContextBlock data={getKnownData()} />
      <ContextBlock data={getUnknownData()} />
    </ClippedBox>
  );
}
