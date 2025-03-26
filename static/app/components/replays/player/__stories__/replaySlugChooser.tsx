import {Fragment, type ReactNode} from 'react';
import {css} from '@emotion/react';

import Providers from 'sentry/components/replays/player/__stories__/providers';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type Props =
  | {render: (replaySlug: string) => ReactNode; children?: never}
  | {children: ReactNode; render?: never};

export default function ReplaySlugChooser(props: Props) {
  const {children, render} = props;

  const [replaySlug, setReplaySlug] = useSessionStorage('stories:replaySlug', '');

  let content = null;
  if (replaySlug) {
    if (children) {
      content = (
        <ReplayLoadingState replaySlug={replaySlug}>
          {({replay}) => <Providers replay={replay}>{children}</Providers>}
        </ReplayLoadingState>
      );
    } else if (render) {
      content = render(replaySlug);
    }
  }

  return (
    <Fragment>
      <input
        defaultValue={replaySlug}
        onChange={event => {
          setReplaySlug(event.target.value);
        }}
        placeholder="Paste a replaySlug"
        css={css`
          font-variant-numeric: tabular-nums;
        `}
        size={34}
      />
      {content}
    </Fragment>
  );
}
