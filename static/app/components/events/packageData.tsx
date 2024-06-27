import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';

type Props = {
  event: Event;
};

export function EventPackageData({event}: Props) {
  let longKeys: boolean, title: string;

  const packages = Object.entries(event.packages || {}).map(([key, value]) => ({
    key,
    value,
    subject: key,
    meta: event._meta?.packages?.[key]?.[''],
  }));

  switch (event.platform) {
    case 'csharp':
      longKeys = true;
      title = t('Assemblies');
      break;
    case 'java':
      longKeys = true;
      title = t('Dependencies');
      break;
    default:
      longKeys = false;
      title = t('Packages');
  }

  if (isEmptyObject(event.packages)) {
    return null;
  }

  return (
    <EventDataSection type="packages" title={title}>
      <ClippedBox>
        <ErrorBoundary mini>
          <KeyValueList data={packages} longKeys={longKeys} />
        </ErrorBoundary>
      </ClippedBox>
    </EventDataSection>
  );
}
