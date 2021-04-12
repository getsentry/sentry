import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {ImageStatus} from 'app/types/debugImage';

import ProcessingItem from '../processing/item';
import ProcessingList from '../processing/list';

import ProcessingIcon from './processingIcon';

type Props = {
  unwind_status?: ImageStatus | null;
  debug_status?: ImageStatus | null;
};

function Processings({unwind_status, debug_status}: Props) {
  const items: React.ComponentProps<typeof ProcessingList>['items'] = [];

  if (debug_status) {
    items.push(
      <StyledProcessingItem
        key="symbolication"
        type="symbolication"
        icon={<ProcessingIcon status={debug_status} />}
      />
    );
  }

  if (unwind_status) {
    items.push(
      <StyledProcessingItem
        key="stack_unwinding"
        type="stack_unwinding"
        icon={<ProcessingIcon status={unwind_status} />}
      />
    );
  }

  return <StyledProcessingList items={items} />;
}

export default Processings;

const StyledProcessingList = styled(ProcessingList)`
  display: flex;
  flex-wrap: wrap;
  margin-bottom: -${space(1)};
`;

const StyledProcessingItem = styled(ProcessingItem)`
  :not(:last-child) {
    padding-right: ${space(2)};
  }
  padding-bottom: ${space(1)};
`;
