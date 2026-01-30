import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {AssertionFailureTree} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/assertionFailureTree';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function UptimeAssertionsSection({event}: {event: Event}) {
  const evidenceData = event.occurrence?.evidenceData;

  if (!evidenceData?.assertionFailureData) {
    return null;
  }

  return (
    <InterimSection
      type={SectionKey.ASSERTIONS}
      title={t('Assertions')}
      disableCollapsePersistence
    >
      <KeyValueList
        data={[
          {
            subject: t('Failure'),
            key: 'assertion_failure_data',
            value: (
              <pre className="val-string">
                <AssertionFailureTree assertion={evidenceData.assertionFailureData} />
              </pre>
            ),
          },
        ]}
      />
    </InterimSection>
  );
}
