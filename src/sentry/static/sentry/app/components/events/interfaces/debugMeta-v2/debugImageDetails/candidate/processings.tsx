import React from 'react';

import {
  CandidateDownloadStatus,
  ImageCandidate,
  ImageCandidateOk,
} from 'app/types/debugImage';

import NotAvailable from '../../notAvailable';
import ProcessingItem from '../../processing/item';
import ProcessingList from '../../processing/list';

import ProcessingIcon from './processingIcon';

type Props = {
  candidate: ImageCandidate;
};

function Processings({candidate}: Props) {
  const items: React.ComponentProps<typeof ProcessingList>['items'] = [];

  if (candidate.download.status !== CandidateDownloadStatus.OK) {
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
