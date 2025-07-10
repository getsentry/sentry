import {Fragment, type ReactNode} from 'react';
import {css} from '@emotion/react';

import Providers from 'sentry/components/replays/player/__stories__/providers';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type Props =
  | {render: (replaySlug: string) => ReactNode; children?: never}
  | {children: ReactNode; render?: never};

export default function ReplaySlugChooser(props: Props) {
  const {children, render} = props;

  const [replaySlug, setReplaySlug] = useSessionStorage('stories:replaySlug', '');

  const input = (
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
  );

  if (replaySlug && children) {
    function Content() {
      const organization = useOrganization();
      const readerResult = useLoadReplayReader({
        orgSlug: organization.slug,
        replaySlug,
        clipWindow: undefined,
      });
      return (
        <ReplayLoadingState readerResult={readerResult}>
          {({replay}) => <Providers replay={replay}>{children}</Providers>}
        </ReplayLoadingState>
      );
    }
    return (
      <Fragment>
        {input}
        <Content />
      </Fragment>
    );
  }

  if (replaySlug && render) {
    return (
      <Fragment>
        {input}
        {render(replaySlug)}
      </Fragment>
    );
  }

  return input;
}
