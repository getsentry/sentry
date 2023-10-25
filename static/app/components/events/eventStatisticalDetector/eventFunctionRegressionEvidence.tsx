import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import {Event, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';

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

  const data: KeyValueListData = [];

  if (defined(evidenceData.function)) {
    data.push({
      key: 'function',
      subject: t('Function Name'),
      value: evidenceData?.function,
    });
  }

  if (defined(evidenceData.package || evidenceData.module)) {
    data.push({
      key: 'package',
      subject: t('Package Name'),
      value: evidenceData.package || evidenceData.module,
    });
  }

  if (defined(evidenceData.file)) {
    data.push({
      key: 'file',
      subject: t('File Name'),
      value: evidenceData.file,
    });
  }

  if (defined(evidenceData.breakpoint)) {
    data.push({
      key: 'regression',
      subject: t('Regression Date'),
      value: getFormattedDate(
        evidenceData.breakpoint * 1000,
        'MMM D, YYYY hh:mm:ss A z',
        {
          local: true,
        }
      ),
    });
  }

  return (
    <EventDataSection title="Function Evidence" type="evidence">
      <KeyValueList data={data} shouldSort={false} />
    </EventDataSection>
  );
}
