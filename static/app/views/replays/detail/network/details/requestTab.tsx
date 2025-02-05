import getOutputType, {
  Output,
} from 'sentry/views/replays/detail/network/details/getOutputType';
import {
  Setup,
  UnsupportedOp,
} from 'sentry/views/replays/detail/network/details/onboarding';
import type {SectionProps} from 'sentry/views/replays/detail/network/details/sections';
import {
  QueryParamsSection,
  RequestPayloadSection,
} from 'sentry/views/replays/detail/network/details/sections';

import {SectionList} from './styles';

type Props = Parameters<typeof getOutputType>[0] & SectionProps;

export default function RequestTab(props: Props) {
  const output = getOutputType(props);

  return (
    <React.Fragment>
      <SectionList>
        <QueryParamsSection {...props} />
        {output === Output.DATA && <RequestPayloadSection {...props} />}
      </SectionList>
      {[Output.SETUP, Output.URL_SKIPPED, Output.BODY_SKIPPED].includes(output) && (
        <Setup showSnippet={output} {...props} />
      )}
      {output === Output.UNSUPPORTED && <UnsupportedOp type="bodies" />}
    </React.Fragment>
  );
}
