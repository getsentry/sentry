import {isRequestFrame} from 'sentry/utils/replays/resourceFrame';
import type {SectionProps} from 'sentry/views/replays/detail/accessibility/details/sections';

export enum Output {
  SETUP = 'setup',
  UNSUPPORTED = 'unsupported',
  URL_SKIPPED = 'url_skipped',
  BODY_SKIPPED = 'body_skipped',
  DATA = 'data',
}

type Args = {
  item: SectionProps['item'];
};

export default function getOutputType({isSetup, item, visibleTab}: Args): Output {
  return Output.DATA;
}
