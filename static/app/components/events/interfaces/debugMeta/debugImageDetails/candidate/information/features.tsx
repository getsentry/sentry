import {Fragment} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import type {CandidateDownload} from 'sentry/types/debugImage';
import {CandidateDownloadStatus, ImageFeature} from 'sentry/types/debugImage';

import {getImageFeatureDescription} from '../utils';

type Props = {
  download: CandidateDownload;
};

function Features({download}: Props) {
  let features: string[] = [];

  if (
    download.status === CandidateDownloadStatus.OK ||
    download.status === CandidateDownloadStatus.DELETED ||
    download.status === CandidateDownloadStatus.UNAPPLIED
  ) {
    features = Object.keys(download.features).filter(
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      feature => download.features[feature]
    );
  }

  return (
    <Fragment>
      {Object.values(ImageFeature).map(imageFeature => {
        const {label, description} = getImageFeatureDescription(imageFeature);

        const isDisabled = !features.includes(imageFeature);

        return (
          <StyledTag
            key={label}
            disabled={isDisabled}
            tooltipText={isDisabled ? undefined : description}
          >
            {label}
          </StyledTag>
        );
      })}
    </Fragment>
  );
}

export default Features;

const StyledTag = styled(Tag)<{disabled: boolean}>`
  opacity: ${p => (p.disabled ? '0.35' : 1)};
`;
