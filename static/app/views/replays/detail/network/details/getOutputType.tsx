import {isRequestFrame} from 'sentry/utils/replays/resourceFrame';
import type {SectionProps} from 'sentry/views/replays/detail/network/details/sections';
import type {TabKey} from 'sentry/views/replays/detail/network/details/tabs';

export enum Output {
  SETUP = 'setup',
  UNSUPPORTED = 'unsupported',
  URL_SKIPPED = 'url_skipped',
  BODY_SKIPPED = 'body_skipped',
  BODY_PARSE_ERROR = 'body_parse_error',
  BODY_PARSE_TIMEOUT = 'body_parse_timeout',
  UNPARSEABLE_BODY_TYPE = 'unparseable_body_type',
  DATA = 'data',
}

type Args = {
  isCaptureBodySetup: boolean;
  isSetup: boolean;
  item: SectionProps['item'];
  visibleTab: TabKey;
};

export default function getOutputType({
  isCaptureBodySetup,
  isSetup,
  item,
  visibleTab,
}: Args): Output {
  if (!isRequestFrame(item)) {
    return Output.UNSUPPORTED;
  }

  if (!isSetup) {
    return Output.SETUP;
  }

  const request = item.data.request;
  const response = item.data.response;

  const hasHeaders =
    Object.keys(request?.headers ?? {}).length ||
    Object.keys(response?.headers ?? {}).length;
  if (hasHeaders && visibleTab === 'details') {
    return Output.DATA;
  }

  const hasBody = request?.body || response?.body;
  if (hasBody && ['request', 'response'].includes(visibleTab)) {
    return Output.DATA;
  }

  const reqWarnings = request?._meta?.warnings ?? ['URL_SKIPPED'];
  const respWarnings = response?._meta?.warnings ?? ['URL_SKIPPED'];
  const isReqUrlSkipped = reqWarnings?.includes('URL_SKIPPED');
  const isRespUrlSkipped = respWarnings?.includes('URL_SKIPPED');

  if (respWarnings?.includes('BODY_PARSE_ERROR')) {
    return Output.BODY_PARSE_ERROR;
  }

  if (respWarnings?.includes('BODY_PARSE_TIMEOUT')) {
    return Output.BODY_PARSE_TIMEOUT;
  }

  if (respWarnings?.includes('UNPARSEABLE_BODY_TYPE')) {
    // Differs from BODY_PARSE_ERROR in that we did not attempt to parse it
    return Output.UNPARSEABLE_BODY_TYPE;
  }

  if (isReqUrlSkipped || isRespUrlSkipped) {
    return Output.URL_SKIPPED;
  }

  // Capture body is not setup (this should also imply there is no body)
  if (['request', 'response'].includes(visibleTab) && !hasBody && !isCaptureBodySetup) {
    return Output.BODY_SKIPPED;
  }

  return Output.DATA;
}
