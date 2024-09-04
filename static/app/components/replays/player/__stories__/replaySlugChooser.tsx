import {Fragment, type ReactNode} from 'react';
import {css} from '@emotion/react';

import Providers from 'sentry/components/replays/player/__stories__/providers';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

export default function ReplaySlugChooser({children}: {children: ReactNode}) {
  const [replaySlug, setReplaySlug] = useSessionStorage('stories:replaySlug', '');

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
      {replaySlug ? <LoadReplay replaySlug={replaySlug}>{children}</LoadReplay> : null}
    </Fragment>
  );
}

function LoadReplay({children, replaySlug}: {children: ReactNode; replaySlug: string}) {
  const organization = useOrganization();
  const {errors, fetching, replay} = useReplayReader({
    orgSlug: organization.slug,
    replaySlug,
  });

  if (errors.length) {
    return errors.at(0)?.title;
  }
  if (!replay || fetching) {
    return 'Loading...';
  }

  return <Providers replay={replay}>{children}</Providers>;
}
