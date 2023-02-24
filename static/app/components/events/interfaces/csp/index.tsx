import {useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {EntryType, Event} from 'sentry/types/event';

import Help, {HelpProps} from './help';

type View = 'report' | 'raw' | 'help';

function getView(view: View, data: Record<any, any>, meta: Record<any, any>) {
  switch (view) {
    case 'report':
      return (
        <KeyValueList
          data={Object.entries(data).map(([key, value]) => {
            return {
              key,
              subject: key,
              value,
              meta: meta?.[key]?.[''],
            };
          })}
          isContextData
        />
      );
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    case 'help':
      return <Help data={data as HelpProps['data']} />;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

type Props = {
  data: Record<string, any>;
  event: Event;
};

export function Csp({data, event}: Props) {
  const [view, setView] = useState<View>('report');

  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.CSP);
  const meta = event._meta?.entries?.[entryIndex]?.data;

  const cleanData =
    data.original_policy !== 'string'
      ? data
      : {
          ...data,
          // Hide the report-uri since this is redundant and silly
          original_policy: data.original_policy.replace(/(;\s+)?report-uri [^;]+/, ''),
        };

  const actions = (
    <SegmentedControl aria-label={t('View')} size="xs" value={view} onChange={setView}>
      <SegmentedControl.Item key="report">{t('Report')}</SegmentedControl.Item>
      <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
      <SegmentedControl.Item key="help">{t('Help')}</SegmentedControl.Item>
    </SegmentedControl>
  );

  return (
    <EventDataSection type="csp" title={t('CSP Report')} actions={actions}>
      {getView(view, cleanData, meta)}
    </EventDataSection>
  );
}
