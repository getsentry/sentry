import styled from '@emotion/styled';

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
  visibleTab,
  ...props
}: {visibleTab: TabKey} & SectionProps) {
  // is it setup?

  switch (visibleTab) {
    case 'request':
      return (
        <SectionList>
          <QueryParamsSection {...props} />
          <RequestPayloadSection {...props} />
        </SectionList>
      );
    case 'response':
      return (
        <SectionList>
          <ResponsePayloadSection {...props} />
        </SectionList>
      );
    case 'details':
    default:
      return (
        <SectionList>
          <GeneralSection {...props} />
          <RequestHeadersSection {...props} />
          <ResponseHeadersSection {...props} />
        </SectionList>
      );
  }
}

const SectionList = styled('dl')`
  height: 100%;
  margin: 0;
  overflow: auto;
`;
