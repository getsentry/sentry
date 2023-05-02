import styled from '@emotion/styled';

import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
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
import type {TabKey} from 'sentry/views/replays/detail/network/details/tabs';

type Props = {
  isSetup: boolean;
  visibleTab: TabKey;
} & SectionProps;

enum Output {
  setup = 'setup',
  unsupported = 'unsupported',
  urlSkipped = 'urlSkipped',
  bodySkipped = 'bodySkipped',
  data = 'data',
}

function getOutputType({isSetup, item, visibleTab}: Props): Output {
  const isSupportedOp = ['resource.fetch', 'resource.xhr'].includes(item.op);
  if (!isSupportedOp) {
    return Output.unsupported;
  }

  if (!isSetup) {
    return Output.setup;
  }

  const request = item.data?.request ?? {};
  const response = item.data?.response ?? {};

  const hasHeadersOrData =
    request.headers || response.headers || request.body || response.body;
  if (hasHeadersOrData) {
    return Output.data;
  }

  const reqWarnings = request._meta?.warnings ?? ['URL_SKIPPED'];
  const respWarnings = response._meta?.warnings ?? ['URL_SKIPPED'];
  const isReqUrlSkipped = reqWarnings?.includes('URL_SKIPPED');
  const isRespUrlSkipped = respWarnings?.includes('URL_SKIPPED');
  if (isReqUrlSkipped || isRespUrlSkipped) {
    return Output.urlSkipped;
  }

  if (['request', 'response'].includes(visibleTab)) {
    const isReqBodySkipped = reqWarnings?.includes('BODY_SKIPPED');
    const isRespBodySkipped = respWarnings?.includes('BODY_SKIPPED');
    if (isReqBodySkipped || isRespBodySkipped) {
      return Output.bodySkipped;
    }
  }

  return Output.data;
}

export default function NetworkDetailsContent(props: Props) {
  const {visibleTab} = props;

  const output = getOutputType(props);

  switch (visibleTab) {
    case 'request':
      return (
        <OverflowFluidHeight>
          <SectionList>
            <QueryParamsSection {...props} />
            {output === Output.data && <RequestPayloadSection {...props} />}
          </SectionList>
          {[Output.setup, Output.urlSkipped, Output.bodySkipped].includes(output) && (
            <Setup showSnippet="bodies" {...props} />
          )}
          {output === Output.unsupported && <UnsupportedOp type="bodies" />}
        </OverflowFluidHeight>
      );
    case 'response':
      return (
        <OverflowFluidHeight>
          {output === Output.data && (
            <SectionList>
              <ResponsePayloadSection {...props} />
            </SectionList>
          )}
          {[Output.setup, Output.urlSkipped, Output.bodySkipped].includes(output) && (
            <Setup showSnippet="bodies" {...props} />
          )}
          {output === Output.unsupported && <UnsupportedOp type="bodies" />}
        </OverflowFluidHeight>
      );
    case 'details':
    default:
      return (
        <OverflowFluidHeight>
          <SectionList>
            <GeneralSection {...props} />
            {output === Output.data && <RequestHeadersSection {...props} />}
            {output === Output.data && <ResponseHeadersSection {...props} />}
          </SectionList>
          {[Output.setup, Output.urlSkipped].includes(output) && (
            <Setup showSnippet="headers" {...props} />
          )}
          {output === Output.unsupported && <UnsupportedOp type="headers" />}
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
