import {useEffect} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFrameMethod, getFrameStatus} from 'sentry/utils/replays/resourceFrame';
import useOrganization from 'sentry/utils/useOrganization';
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
  const {item, isSetup, visibleTab} = props;

  const output = getOutputType(props);

  const organization = useOrganization();
  useEffect(() => {
    trackAnalytics('replay.details-network-tab-changed', {
      is_sdk_setup: isSetup,
      organization,
      output,
      resource_method: getFrameMethod(item),
      resource_status: String(getFrameStatus(item)),
      resource_type: item.op,
      tab: visibleTab,
    });
  }, [isSetup, item, organization, output, visibleTab]);

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
          {output === Output.BODY_PARSE_ERROR && (
            <ParseError>{t('The SDK was unable to parse the response body.')}</ParseError>
          )}
          {output === Output.BODY_PARSE_TIMEOUT && (
            <ParseError>
              {t(
                'The SDK timed out while parsing response body. This is to reduce CPU usage on client browsers.'
              )}
            </ParseError>
          )}
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
const ParseError = styled('p')`
  padding: ${space(2)};
`;
