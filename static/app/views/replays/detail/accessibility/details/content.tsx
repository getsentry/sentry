import styled from '@emotion/styled';

import type {SectionProps} from 'sentry/views/replays/detail/accessibility/details/sections';
import {
  ElementSection,
  GeneralSection,
} from 'sentry/views/replays/detail/accessibility/details/sections';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = SectionProps;

export default function AccessibilityDetailsContent(props: Props) {
  return (
    <OverflowFluidHeight>
      <SectionList>
        <ElementSection {...props} />
        <GeneralSection {...props} />
      </SectionList>
    </OverflowFluidHeight>
  );
}

const OverflowFluidHeight = styled(FluidHeight)`
  overflow: auto;
`;
const SectionList = styled('dl')`
  margin: 0;
`;
