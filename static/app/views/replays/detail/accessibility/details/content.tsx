import styled from '@emotion/styled';

import type {SectionProps} from 'sentry/views/replays/detail/accessibility/details/sections';
import {GeneralSection} from 'sentry/views/replays/detail/accessibility/details/sections';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = SectionProps;

export default function AccessibilityDetailsContent(props: Props) {
  // const organization = useOrganization();

  return (
    <OverflowFluidHeight>
      <GeneralSection {...props} />
    </OverflowFluidHeight>
  );
}

const OverflowFluidHeight = styled(FluidHeight)`
  overflow: auto;
`;
