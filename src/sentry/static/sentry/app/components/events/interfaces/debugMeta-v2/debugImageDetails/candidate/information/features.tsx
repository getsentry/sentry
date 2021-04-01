import React from 'react';
import styled from '@emotion/styled';

import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';
import {
  CandidateDownload,
  CandidateDownloadStatus,
  CandidateFeatures,
} from 'app/types/debugImage';

import {getFeatureLabel} from '../utils';

type Props = {
  download: CandidateDownload;
};

function Features({download}: Props) {
  if (
    download.status !== CandidateDownloadStatus.OK &&
    download.status !== CandidateDownloadStatus.DELETED &&
    download.status !== CandidateDownloadStatus.UNAPPLIED
  ) {
    return null;
  }

  const features = Object.entries(download.features).filter(([_key, value]) => value);

  if (!features.length) {
    return null;
  }

  return (
    <Wrapper>
      {features.map(([key]) => {
        const {label, description} = getFeatureLabel(key as keyof CandidateFeatures);
        return (
          <Feature key={key}>
            {label}
            <QuestionTooltip title={description} size="xs" />
          </Feature>
        );
      })}
    </Wrapper>
  );
}

export default Features;

const Wrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const Feature = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(0.5)};
  align-items: center;
  padding-right: ${space(1.5)};
`;
