import {useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

import Help from './help';

type View = 'report' | 'raw' | 'help';

function getView(view: View, data: Record<any, any>, event: Record<any, any>) {
  switch (view) {
    case 'report':
      const viewData = data.body;
      viewData.url = data.url;
      viewData.elapsed_time = viewData.elapsed_time + ' ms';

      return (
        <KeyValueList
          data={Object.entries(viewData).map(([key, value]) => {
            return {
              key,
              subject: key,
              value,
            };
          })}
          isContextData
        />
      );
    case 'raw':
      return <pre>{JSON.stringify(data, null, 2)}</pre>;
    case 'help':
      return <Help data={event} />;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

type Props = {
  data: Record<string, any>;
  event: Event;
};

export function Nel({data, event}: Props) {
  const [view, setView] = useState<View>('report');

  const viewData = {...data};
  viewData.body = {...data.body};
  if (view === 'report') {
    delete viewData.age;
    delete viewData.body.sampling_fraction;
    delete viewData.ty;
  }

  const actions = (
    <SegmentedControl aria-label={t('View')} size="xs" value={view} onChange={setView}>
      <SegmentedControl.Item key="report">{t('Report')}</SegmentedControl.Item>
      <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
      <SegmentedControl.Item key="help">{t('Help')}</SegmentedControl.Item>
    </SegmentedControl>
  );

  return (
    <EventDataSection type="nel" title={t('NEL Report')} actions={actions}>
      {getView(view, viewData, event)}
    </EventDataSection>
  );
}
