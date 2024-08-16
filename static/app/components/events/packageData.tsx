import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

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
    <InterimSection title={title} type={SectionKey.PACKAGES}>
      <ClippedBox>
        <ErrorBoundary mini>
          <KeyValueList data={packages} longKeys={longKeys} />
        </ErrorBoundary>
      </ClippedBox>
    </InterimSection>
  );
}
