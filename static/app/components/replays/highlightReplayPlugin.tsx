import type {Replayer} from 'rrweb';
import type {eventWithTime} from 'rrweb/typings/types';

import type {HighlightsByTime} from 'sentry/views/replays/types';

interface HighlightReplayPluginOptions {
  highlights: HighlightsByTime;
  defaultHighlightColor?: string;
}

class HighlightReplayPlugin {
  highlights: HighlightsByTime;
  defaultHighlightColor: string;

  constructor({
    highlights,
    // TODO(replays): Figure out a better color
    defaultHighlightColor = 'rgba(255, 192, 203, 0.5)',
  }: HighlightReplayPluginOptions) {
    this.defaultHighlightColor = defaultHighlightColor;
    this.highlights = highlights;
  }

  handler(event: eventWithTime, _isSync: boolean, context: {replayer: Replayer}) {
    if (!this.highlights.size) {
      return;
    }

    const ts = Math.floor(event.timestamp / 1000);
    const highlightObj = this.highlights.get(ts);

    // ts has some issues with control flow analysis, so it will complain if we
    // use `has` to check existance. instead, ensure that it is not undefined.
    // See https://github.com/Microsoft/TypeScript/issues/9619
    if (!highlightObj) {
      return;
    }

    // @ts-expect-error mirror is private :/
    const node = context.replayer.mirror.getNode(highlightObj.nodeId);

    if (context.replayer.iframe.contentDocument?.body.contains(node)) {
      // TODO(replays): Figure out when to change the background back
      // TODO(replays): We should instead draw this in canvas as it will be more reliable to "highlight"
      // TODO(replays): Write out "LCP" w/ canvas
      node.style.background = highlightObj.color ?? this.defaultHighlightColor;
    }
  }
}

export {HighlightReplayPlugin};
