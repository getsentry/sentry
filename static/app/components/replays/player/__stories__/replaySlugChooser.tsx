import {Fragment, type ReactNode} from 'react';
import {css} from '@emotion/react';

import Providers from 'sentry/components/replays/player/__stories__/providers';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useOrganization from 'sentry/utils/useOrganization';
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
      content = <LoadReplay replaySlug={replaySlug}>{children}</LoadReplay>;
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

function LoadReplay({children, replaySlug}: {children: ReactNode; replaySlug: string}) {
  const organization = useOrganization();
  const {fetchError, fetching, replay} = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug,
  });

  if (fetchError) {
    return fetchError.message;
  }
  if (!replay || fetching) {
    return 'Loading...';
  }

  return <Providers replay={replay}>{children}</Providers>;
}
