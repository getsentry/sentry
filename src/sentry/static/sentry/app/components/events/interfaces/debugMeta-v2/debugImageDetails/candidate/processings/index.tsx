import React from 'react';
import styled from '@emotion/styled';

import NotAvailable from 'app/components/notAvailable';
import {t} from 'app/locale';
import {
  CandidateDownloadStatus,
  ImageCandidate,
  ImageCandidateOk,
} from 'app/types/debugImage';

import ProcessingItem from '../../../processing/item';
import ProcessingList from '../../../processing/list';

import Icon from './icon';

type Props = {
  candidate: ImageCandidate;
};

function Processings({candidate}: Props) {
  const items: React.ComponentProps<typeof ProcessingList>['items'] = [];

  if (
    candidate.download.status !== CandidateDownloadStatus.OK &&
    candidate.download.status !== CandidateDownloadStatus.DELETED
  ) {
    return <NotAvailable tooltip={t('Processing info not available')} />;
  }

  const {debug, unwind} = candidate as ImageCandidateOk;

  if (debug) {
    items.push(
      <ProcessingItem
        key="symbolication"
        type="symbolication"
        icon={<Icon processingInfo={debug} />}
      />
    );
  }

  if (unwind) {
    items.push(
      <ProcessingItem
        key="stack_unwinding"
        type="stack_unwinding"
        icon={<Icon processingInfo={unwind} />}
      />
    );
  }

  return <StyledProcessingList items={items} />;
}

export default Processings;

const StyledProcessingList = styled(ProcessingList)`
  flex-direction: column;
`;
