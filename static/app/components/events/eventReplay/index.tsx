import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import Anchor from 'sentry/components/links/anchor';
import {Event} from 'sentry/types/event';

type Props = {
  event: Event;
  orgSlug: string;
  projectSlug: string;
  replayId: string;
};

export default function EventReplay({replayId, orgSlug, projectSlug, event}: Props) {
  return (
    <div id="replay">
      <StyledAnchor href="#replay">
        <h3 aria-label="Replay">Replay</h3>
      </StyledAnchor>
      <ErrorBoundary mini>
        <LazyLoad
          component={() => import('./replayContent')}
          replaySlug={`${projectSlug}:${replayId}`}
          orgSlug={orgSlug}
          event={event}
        />
      </ErrorBoundary>
    </div>
  );
}

const StyledAnchor = styled(Anchor)`
  display: none;
`;
