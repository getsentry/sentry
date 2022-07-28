import {Fragment} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/tag';
import {
  CandidateDownload,
  CandidateDownloadStatus,
  ImageFeature,
} from 'sentry/types/debugImage';

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
      feature => download.features[feature]
    );
  }

  return (
    <Fragment>
      {Object.keys(ImageFeature).map(imageFeature => {
        const {label, description} = getImageFeatureDescription(
          imageFeature as ImageFeature
        );

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
