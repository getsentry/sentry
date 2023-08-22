import styled from '@emotion/styled';

import getOutputType from 'sentry/views/replays/detail/accessibility/details/getOutputType';
import type {SectionProps} from 'sentry/views/replays/detail/accessibility/details/sections';
import {GeneralSection} from 'sentry/views/replays/detail/accessibility/details/sections';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = Parameters<typeof getOutputType>[0] & SectionProps;

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
