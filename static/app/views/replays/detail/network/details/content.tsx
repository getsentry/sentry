import styled from '@emotion/styled';

import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import getOutputType, {
  Output,
} from 'sentry/views/replays/detail/network/details/getOutputType';
import {
  Setup,
  UnsupportedOp,
} from 'sentry/views/replays/detail/network/details/onboarding';
import type {SectionProps} from 'sentry/views/replays/detail/network/details/sections';
import {
  GeneralSection,
  QueryParamsSection,
  RequestHeadersSection,
  RequestPayloadSection,
  ResponseHeadersSection,
  ResponsePayloadSection,
} from 'sentry/views/replays/detail/network/details/sections';

type Props = Parameters<typeof getOutputType>[0] & SectionProps;

export default function NetworkDetailsContent(props: Props) {
  const {visibleTab} = props;

  const output = getOutputType(props);

  switch (visibleTab) {
    case 'request':
      return (
        <OverflowFluidHeight>
          <SectionList>
            <QueryParamsSection {...props} />
            {output === Output.DATA && <RequestPayloadSection {...props} />}
          </SectionList>
          {[Output.SETUP, Output.URL_SKIPPED, Output.BODY_SKIPPED].includes(output) && (
            <Setup showSnippet={output} {...props} />
          )}
          {output === Output.UNSUPPORTED && <UnsupportedOp type="bodies" />}
        </OverflowFluidHeight>
      );
    case 'response':
      return (
        <OverflowFluidHeight>
          {output === Output.DATA && (
            <SectionList>
              <ResponsePayloadSection {...props} />
            </SectionList>
          )}
          {[Output.SETUP, Output.URL_SKIPPED, Output.BODY_SKIPPED].includes(output) && (
            <Setup showSnippet={output} {...props} />
          )}
          {output === Output.UNSUPPORTED && <UnsupportedOp type="bodies" />}
        </OverflowFluidHeight>
      );
    case 'details':
    default:
      return (
        <OverflowFluidHeight>
          <SectionList>
            <GeneralSection {...props} />
            {output === Output.DATA && <RequestHeadersSection {...props} />}
            {output === Output.DATA && <ResponseHeadersSection {...props} />}
          </SectionList>
          {[Output.SETUP, Output.URL_SKIPPED, Output.DATA].includes(output) && (
            <Setup showSnippet={output} {...props} />
          )}
          {output === Output.UNSUPPORTED && <UnsupportedOp type="headers" />}
        </OverflowFluidHeight>
      );
  }
}

const OverflowFluidHeight = styled(FluidHeight)`
  overflow: auto;
`;
const SectionList = styled('dl')`
  margin: 0;
`;
