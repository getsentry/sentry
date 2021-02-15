import React from 'react';

import NotAvailable from 'app/components/notAvailable';
import {
  CandidateDownloadStatus,
  ImageCandidate,
  ImageCandidateOk,
} from 'app/types/debugImage';

import ProcessingItem from '../../processing/item';
import ProcessingList from '../../processing/list';

import ProcessingIcon from './processingIcon';

type Props = {
  candidate: ImageCandidate;
};

function Processings({candidate}: Props) {
  const items: React.ComponentProps<typeof ProcessingList>['items'] = [];

  if (
    candidate.download.status !== CandidateDownloadStatus.OK &&
    candidate.download.status !== CandidateDownloadStatus.DELETED
  ) {
    return <NotAvailable />;
  }

  const {debug, unwind} = candidate as ImageCandidateOk;

  if (debug) {
    items.push(
      <ProcessingItem
        key="symbolication"
        type="symbolication"
        icon={<ProcessingIcon processingInfo={debug} />}
      />
    );
  }

  if (unwind) {
    items.push(
      <ProcessingItem
        key="stack_unwinding"
        type="stack_unwinding"
        icon={<ProcessingIcon processingInfo={unwind} />}
      />
    );
  }

  return <ProcessingList items={items} />;
}

export default Processings;
