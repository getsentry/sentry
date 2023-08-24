import upperFirst from 'lodash/upperFirst';

import ClippedBox from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {getChildMetaContainer} from 'sentry/components/events/meta/metaContainer';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types';

type KeyValueListData = React.ComponentProps<typeof ContextBlock>['data'];

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
  const meta = getChildMetaContainer(event._meta, 'contexts', 'state');

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
        value: data.state.value,
        meta: getChildMetaContainer(meta, 'state', 'value'),
      },
    ];
  }

  function getUnknownData(): KeyValueListData {
    return Object.entries(data)
      .filter(([key]) => !['type', 'title', 'state'].includes(key))
      .map(([name, state]) => ({
        key: name,
        value: state.value,
        subject: getStateTitle(name, state.type),
        meta: getChildMetaContainer(meta, name, 'value'),
      }));
  }

  return (
    <ClippedBox clipHeight={250}>
      <ContextBlock data={getKnownData()} />
      <ContextBlock data={getUnknownData()} />
    </ClippedBox>
  );
}
