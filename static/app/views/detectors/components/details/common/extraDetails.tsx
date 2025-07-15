import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useUserFromId from 'sentry/utils/useUserFromId';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';

type Props = {
  children: React.ReactNode;
};

export function DetectorExtraDetails({children}: Props) {
  return (
    <Section title={t('Details')}>
      <StyledKeyValueTable>{children}</StyledKeyValueTable>
    </Section>
  );
}

const StyledKeyValueTable = styled(KeyValueTable)`
  grid-template-columns: min-content auto;
`;

DetectorExtraDetails.DateCreated = function DetectorExtraDetailsDateCreated({
  detector,
}: {
  detector: Detector;
}) {
  return (
    <KeyValueTableRow
      keyName={t('Date created')}
      value={<DateTime date={detector.dateCreated} dateOnly year />}
    />
  );
};

DetectorExtraDetails.CreatedBy = function DetectorExtraDetailsCreatedBy({
  detector,
}: {
  detector: Detector;
}) {
  const createdBy = detector.createdBy ?? null;

  const {isPending, data: user} = useUserFromId({
    id: createdBy ? parseInt(createdBy, 10) : undefined,
  });

  const keyName = t('Created by');

  if (!createdBy) {
    return <KeyValueTableRow keyName={keyName} value={t('Sentry')} />;
  }

  if (isPending) {
    return (
      <KeyValueTableRow
        keyName={keyName}
        value={<Placeholder width="80px" height="16px" />}
      />
    );
  }

  const title = user?.name ?? user?.email ?? t('Unknown');
  return (
    <KeyValueTableRow
      keyName={keyName}
      value={
        <Tooltip title={title} showOnlyOnOverflow>
          <TextOverflow>{title}</TextOverflow>
        </Tooltip>
      }
    />
  );
};

DetectorExtraDetails.LastModified = function DetectorExtraDetailsLastModified({
  detector,
}: {
  detector: Detector;
}) {
  return (
    <KeyValueTableRow
      keyName={t('Last modified')}
      value={<TimeSince date={detector.dateUpdated} />}
    />
  );
};

DetectorExtraDetails.Environment = function DetectorExtraDetailsEnvironment({
  detector,
}: {
  detector: Detector;
}) {
  const environment = getDetectorEnvironment(detector);
  const environmentLabel = environment ?? t('All environments');

  return (
    <KeyValueTableRow
      keyName={t('Environment')}
      value={
        <Tooltip title={environmentLabel} showOnlyOnOverflow>
          <TextOverflow>{environmentLabel}</TextOverflow>
        </Tooltip>
      }
    />
  );
};
