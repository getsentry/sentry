import React from 'react';

import {CandidateDownload, CandidateDownloadStatus} from 'app/types/debugImage';

import NotAvailable from '../../notAvailable';
import ProcessingItem from '../../processing/item';
import ProcessingList from '../../processing/list';

import ProcessingIcon from './processingIcon';

type Props = {
  download: CandidateDownload;
};

function Processings({download}: Props) {
  const items: React.ComponentProps<typeof ProcessingList>['items'] = [];

  if (download.status !== CandidateDownloadStatus.OK) {
    return <NotAvailable />;
  }

  if (download.debug) {
    items.push(
      <ProcessingItem
        key="symbolication"
        type="symbolication"
        icon={<ProcessingIcon processingInfo={download.debug} />}
      />
    );
  }

  if (download.unwind) {
    items.push(
      <ProcessingItem
        key="stack_unwinding"
        type="stack_unwinding"
        icon={<ProcessingIcon processingInfo={download.unwind} />}
      />
    );
  }

  return <ProcessingList items={items} />;
}

export default Processings;
