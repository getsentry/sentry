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
import {TabKey} from 'sentry/views/replays/detail/network/details/tabs';

export default function NetworkDetailsContent({
  isSetup,
  visibleTab,
  ...props
}: {isSetup: boolean; visibleTab: TabKey} & SectionProps) {
  const {item} = props;

  const isSupportedOp = ['resource.fetch', 'resource.xhr'].includes(item.op);
  const showContent = isSupportedOp && isSetup;
  const showSetup = isSupportedOp && !isSetup;

  switch (visibleTab) {
    case 'request':
      return (
        <FluidHeight overflow="auto">
          <SectionList>
            <QueryParamsSection {...props} />
            {showContent ? <RequestPayloadSection {...props} /> : null}
          </SectionList>
          {showSetup ? <Setup showSnippet="bodies" {...props} /> : null}
          {isSupportedOp ? null : <UnsupportedOp type="bodies" />}
        </FluidHeight>
      );
    case 'response':
      return (
        <FluidHeight overflow="auto">
          {showContent ? (
            <SectionList>
              <ResponsePayloadSection {...props} />
            </SectionList>
          ) : null}
          {showSetup ? <Setup showSnippet="bodies" {...props} /> : null}
          {isSupportedOp ? null : <UnsupportedOp type="bodies" />}
        </FluidHeight>
      );
    case 'details':
    default:
      return (
        <FluidHeight overflow="auto">
          <SectionList>
            <GeneralSection {...props} />
            {showContent ? <RequestHeadersSection {...props} /> : null}
            {showContent ? <ResponseHeadersSection {...props} /> : null}
          </SectionList>
          {showSetup ? <Setup showSnippet="headers" {...props} /> : null}
          {isSupportedOp ? null : <UnsupportedOp type="headers" />}
        </FluidHeight>
      );
  }
}

const SectionList = styled('dl')`
  margin: 0;
`;
