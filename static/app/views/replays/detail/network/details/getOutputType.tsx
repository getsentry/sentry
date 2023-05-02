import type {SectionProps} from 'sentry/views/replays/detail/network/details/sections';
import type {TabKey} from 'sentry/views/replays/detail/network/details/tabs';

export enum Output {
  setup = 'setup',
  unsupported = 'unsupported',
  urlSkipped = 'urlSkipped',
  bodySkipped = 'bodySkipped',
  data = 'data',
}

type Args = {
  isSetup: boolean;
  item: SectionProps['item'];
  visibleTab: TabKey;
};

export default function getOutputType({isSetup, item, visibleTab}: Args): Output {
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
