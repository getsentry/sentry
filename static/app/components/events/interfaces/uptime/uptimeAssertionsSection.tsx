import {KeyValue} from 'sentry/components/keyValue';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {AssertionFailureTree} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/assertionFailureTree';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

export function UptimeAssertionsSection({event}: {event: Event}) {
  const evidenceData = event.occurrence?.evidenceData;

  if (!evidenceData?.assertionFailureData) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.ASSERTIONS}
      title={t('Assertions')}
      disableCollapsePersistence
    >
      <KeyValue
        items={[
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
        layout="detail"
        sort="key"
      />
    </FoldSection>
  );
}
