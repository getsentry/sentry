import React from 'react';

import {ImageProcessingInfo} from 'app/types/debugImage';

import ProcessingItem from '../processing/item';
import ProcessingList from '../processing/list';

import ProcessingIcon from './processingIcon';

type Props = {
  unwind_status?: ImageProcessingInfo | null;
  debug_status?: ImageProcessingInfo | null;
};

function Processings({unwind_status, debug_status}: Props) {
  const items: React.ComponentProps<typeof ProcessingList>['items'] = [];

  if (debug_status) {
    items.push(
      <ProcessingItem
        type="symbolication"
        icon={<ProcessingIcon status={debug_status} />}
      />
    );
  }

  if (unwind_status) {
    items.push(
      <ProcessingItem
        type="stack_unwinding"
        icon={<ProcessingIcon status={unwind_status} />}
      />
    );
  }

  return <ProcessingList items={items} />;
}

export default Processings;
