import type {Event} from '@sentry/types';

import ClippedBox from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {t} from 'sentry/locale';

type Props = {
  alias: string;
  data: Record<string, any>;
  event: Event;
  meta?: Record<string, any>;
};

export function getReduxContextData({data}: Pick<Props, 'data'>) {
  return [
    {
      key: 'value',
      subject: t('Latest State'),
      // TODO(TS): Objects cannot be rendered to the dom
      value: JSON.stringify(data),
    },
  ];
}

export function ReduxContext({data}: Props) {
  const reduxData = getReduxContextData({data});
  return (
    <ClippedBox clipHeight={250}>
      <ContextBlock data={reduxData} />
    </ClippedBox>
  );
}
