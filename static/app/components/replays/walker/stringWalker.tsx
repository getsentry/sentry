import {memo} from 'react';

import ChevronDividedList from 'sentry/components/replays/walker/chevronDividedList';
import splitCrumbs from 'sentry/components/replays/walker/splitCrumbs';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {ReplayFrame} from 'sentry/utils/replays/types';

type StringProps = {
  urls: string[];
};

const StringWalker = memo(function StringWalker({urls}: StringProps) {
  return (
    <ChevronDividedList
      items={splitCrumbs({
        frames: urls.map(urlToFrame),
        startTimestampMs: 0,
        onClick: null,
      })}
    />
  );
});

export default StringWalker;

function urlToFrame(url: string): ReplayFrame {
  const now = new Date();
  return {
    category: 'navigation',
    data: {
      from: '',
      to: url,
    },
    message: url,
    timestamp: now,
    type: BreadcrumbType.NAVIGATION,
    offsetMs: 0,
    timestampMs: now.getTime() / 1000,
  };
}
