import {Fragment} from 'react';

import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {Placeholder} from 'sentry/components/placeholder';
import {TextOverflow} from 'sentry/components/textOverflow';
import {TimeSince} from 'sentry/components/timeSince';
import {DetailSection} from 'sentry/components/workflowEngine/ui/detailSection';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useUserFromId} from 'sentry/utils/useUserFromId';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';

type Props = {
  children: React.ReactNode;
};

export function DetectorExtraDetails({children}: Props) {
  return (
    <DetailSection title={t('Details')}>
      <DescriptionList>{children}</DescriptionList>
    </DetailSection>
  );
}

DetectorExtraDetails.DateCreated = function DetectorExtraDetailsDateCreated({
  detector,
}: {
  detector: Detector;
}) {
  return (
    <Fragment>
      <DescriptionList.Term>{t('Date created')}</DescriptionList.Term>
      <DescriptionList.Details>
        <DateTime date={detector.dateCreated} dateOnly year />
      </DescriptionList.Details>
    </Fragment>
  );
};

DetectorExtraDetails.CreatedBy = function DetectorExtraDetailsCreatedBy({
  detector,
}: {
  detector: Detector;
}) {
  const createdBy = detector.createdBy ?? null;

  const {
    isPending,
    isError,
    data: user,
  } = useUserFromId({
    id: createdBy ? parseInt(createdBy, 10) : undefined,
  });

  const keyName = t('Created by');

  if (!createdBy) {
    return (
      <Fragment>
        <DescriptionList.Term>{keyName}</DescriptionList.Term>
        <DescriptionList.Details>{t('Sentry')}</DescriptionList.Details>
      </Fragment>
    );
  }

  if (isPending) {
    return (
      <Fragment>
        <DescriptionList.Term>{keyName}</DescriptionList.Term>
        <DescriptionList.Details>
          <Placeholder width="80px" height="16px" />
        </DescriptionList.Details>
      </Fragment>
    );
  }

  if (isError) {
    return (
      <Fragment>
        <DescriptionList.Term>{keyName}</DescriptionList.Term>
        <DescriptionList.Details>{t('Deactivated user')}</DescriptionList.Details>
      </Fragment>
    );
  }

  const title = user?.name ?? user?.email ?? t('Unknown');
  return (
    <Fragment>
      <DescriptionList.Term>{keyName}</DescriptionList.Term>
      <DescriptionList.Details>
        <Tooltip title={title} showOnlyOnOverflow>
          <TextOverflow>{title}</TextOverflow>
        </Tooltip>
      </DescriptionList.Details>
    </Fragment>
  );
};

DetectorExtraDetails.LastModified = function DetectorExtraDetailsLastModified({
  detector,
}: {
  detector: Detector;
}) {
  return (
    <Fragment>
      <DescriptionList.Term>{t('Last modified')}</DescriptionList.Term>
      <DescriptionList.Details>
        <TimeSince date={detector.dateUpdated} />
      </DescriptionList.Details>
    </Fragment>
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
    <Fragment>
      <DescriptionList.Term>{t('Environment')}</DescriptionList.Term>
      <DescriptionList.Details>
        <Tooltip title={environmentLabel} showOnlyOnOverflow>
          <TextOverflow>{environmentLabel}</TextOverflow>
        </Tooltip>
      </DescriptionList.Details>
    </Fragment>
  );
};
