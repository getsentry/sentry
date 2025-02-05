import {t} from 'sentry/locale';
import type {NetworkMetaWarning} from 'sentry/utils/replays/replay';
import {isRequestFrame} from 'sentry/utils/replays/resourceFrame';
import getOutputType from 'sentry/views/replays/detail/network/details/getOutputType';
import {
  Setup,
  UnsupportedOp,
} from 'sentry/views/replays/detail/network/details/onboarding';
import type {SectionProps} from 'sentry/views/replays/detail/network/details/sections';
import {ResponsePayloadSection} from 'sentry/views/replays/detail/network/details/sections';

import {ParseError, SectionList} from './styles';

type Props = Parameters<typeof getOutputType>[0] & SectionProps;

const ERRORS_MAP: Partial<Record<NetworkMetaWarning, string>> = {
  BODY_PARSE_ERROR: t('The SDK was unable to parse the response body.'),
  BODY_PARSE_TIMEOUT: t(
    'The SDK timed out while parsing response body. This is to reduce CPU usage on client browsers.'
  ),
  UNPARSEABLE_BODY_TYPE: t(
    'This request body contains an unsupported type and was not captured. For example, blobs are unsupported as they are not human-readable.'
  ),
};

export function ResponseTab(props: Props) {
  const {item, isSetup} = props;

  if (!isRequestFrame(item)) {
    return <UnsupportedOp type="bodies" />;
  }

  const {response} = item.data;

  // Network capture is setup and there is a response body
  // Prioritize showing payload if body exists as we can have warnings when parsing body
  // e.g. MAYBE_JSON_TRUNCATED or TEXT_TRUNCATED
  if (isSetup && response?.body) {
    return (
      <SectionList>
        <ResponsePayloadSection {...props} />
      </SectionList>
    );
  }

  const warnings = response?._meta?.warnings ?? [];
  // Technically we could have multiple warnings, but I think in practice
  // there's only one.
  const firstWarning = warnings.length > 0 && warnings[0];

  // Old SDKs did not include `URL_SKIPPED`
  if (firstWarning && firstWarning !== 'URL_SKIPPED') {
    const errorMessage =
      firstWarning && firstWarning in ERRORS_MAP
        ? ERRORS_MAP[firstWarning]
        : t('There was an unknown error parsing the response body.');
    return <ParseError>{errorMessage}</ParseError>;
  }

  // Otherwise, show onboarding setup. Some common reasons:
  // * when `isSetup == false` (SDK not setup)
  // * when URL was skipped by SDK
  // * when response body was skipped by SDK
  return <Setup showSnippet={getOutputType(props)} {...props} />;
}
