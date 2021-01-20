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
      <ProcessingItem
        key="symbolication"
        type="symbolication"
        icon={<ProcessingIcon status={debug_status} />}
      />
    );
  }

  if (unwind_status) {
    items.push(
      <ProcessingItem
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
  grid-auto-flow: row;
  grid-gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-auto-flow: column;
  }
`;
