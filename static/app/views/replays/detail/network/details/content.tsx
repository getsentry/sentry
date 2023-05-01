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

export default function NetworkDetailsContent({
  isSetup,
  visibleTab,
  ...props
}: {isSetup: boolean; visibleTab: TabKey} & SectionProps) {
  const {item} = props;

  const reqWarnings = item.data.request?._meta?.warnings as undefined | string[];
  const respWarnings = item.data.response?._meta?.warnings as undefined | string[];
  const isReqUrlSkipped = reqWarnings?.includes('URL_SKIPPED');
  const isRespUrlSkipped = respWarnings?.includes('URL_SKIPPED');

  const isSupportedOp = ['resource.fetch', 'resource.xhr'].includes(item.op);
  const showReqContent = isSupportedOp && isSetup && !isReqUrlSkipped;
  const showRespContent = isSupportedOp && isSetup && !isRespUrlSkipped;
  const showSetup = isSupportedOp && (!isSetup || isReqUrlSkipped || isRespUrlSkipped);

  // console.log({
  //   isSetup,
  //   isSupportedOp,
  //   reqWarnings,
  //   respWarnings,
  //   isReqUrlSkipped,
  //   isRespUrlSkipped,
  //   showReqContent,
  //   showRespContent,
  //   showSetup,
  // });

  switch (visibleTab) {
    case 'request':
      return (
        <OverflowFluidHeight>
          <SectionList>
            <QueryParamsSection {...props} />
            {showReqContent ? <RequestPayloadSection {...props} /> : null}
          </SectionList>
          {showSetup ? <Setup showSnippet="bodies" {...props} /> : null}
          {isSupportedOp ? null : <UnsupportedOp type="bodies" />}
        </OverflowFluidHeight>
      );
    case 'response':
      return (
        <OverflowFluidHeight>
          {showRespContent ? (
            <SectionList>
              <ResponsePayloadSection {...props} />
            </SectionList>
          ) : null}
          {showSetup ? <Setup showSnippet="bodies" {...props} /> : null}
          {isSupportedOp ? null : <UnsupportedOp type="bodies" />}
        </OverflowFluidHeight>
      );
    case 'details':
    default:
      return (
        <OverflowFluidHeight>
          <SectionList>
            <GeneralSection {...props} />
            {showReqContent ? <RequestHeadersSection {...props} /> : null}
            {showRespContent ? <ResponseHeadersSection {...props} /> : null}
          </SectionList>
          {showSetup ? <Setup showSnippet="headers" {...props} /> : null}
          {isSupportedOp ? null : <UnsupportedOp type="headers" />}
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
