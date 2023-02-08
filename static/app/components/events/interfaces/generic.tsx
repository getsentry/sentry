import {useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';

function getView({
  data,
  meta,
  view,
}: {
  data: Props['data'];
  view: View;
  meta?: Record<any, any>;
}) {
  switch (view) {
    case 'report':
      return !data ? (
        <AnnotatedText value={data} meta={meta?.['']} />
      ) : (
        <KeyValueList
          data={Object.entries(data).map(([key, value]) => ({
            key,
            value,
            subject: key,
            meta: meta?.[key]?.[''],
          }))}
          isContextData
        />
      );
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

type Props = {
  data: Record<string, any> | null;
  type: string;
  meta?: Record<string, any>;
};

type View = 'report' | 'raw';

export function Generic({type, data, meta}: Props) {
  const [view, setView] = useState<View>('report');
  return (
    <EventDataSection
      type={type}
      title={t('Report')}
      actions={
        <SegmentedControl
          aria-label={t('View')}
          size="xs"
          value={view}
          onChange={setView}
        >
          <SegmentedControl.Item key="report">{t('Report')}</SegmentedControl.Item>
          <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
        </SegmentedControl>
      }
    >
      {getView({view, data, meta})}
    </EventDataSection>
  );
}
