import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface EventFunctionRegressionEvidenceProps {
  event: Event;
}

export function EventFunctionRegressionEvidence({
  event,
}: EventFunctionRegressionEvidenceProps) {
  const evidenceData = event.occurrence?.evidenceData;
  if (!defined(evidenceData)) {
    return null;
  }

  const data: KeyValueListData = [
    {
      key: 'function',
      subject: t('Function Name'),
      value: evidenceData?.function || t('unknown'),
    },
    {
      key: 'package',
      subject: t('Package Name'),
      value: evidenceData.package || evidenceData.module || t('unknown'),
    },
    {
      key: 'file',
      subject: t('File Name'),
      value: evidenceData.file || t('unknown'),
    },
    {
      key: 'regression',
      subject: t('Regression Date'),
      value: getFormattedDate(
        evidenceData.breakpoint * 1000,
        'MMM D, YYYY hh:mm:ss A z',
        {
          local: true,
        }
      ),
    },
  ];

  return (
    <InterimSection title={t('Function Evidence')} type={SectionKey.EVIDENCE}>
      <KeyValueList data={data} shouldSort={false} />
    </InterimSection>
  );
}
