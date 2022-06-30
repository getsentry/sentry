import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import DetailsPageBreadcrumbs from 'sentry/components/replays/header/detailsPageBreadcrumbs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';

type Props = {
  children: ReactNode;
  eventSlug: string;
  orgId: string;
  event?: Event;
};

function Page({children, event, orgId, eventSlug}: Props) {
  const title = event ? `${event.id} - Replays - ${orgId}` : `Replays - ${orgId}`;

  return (
    <SentryDocumentTitle title={title}>
      <FullViewport>
        <Layout.Header>
          <Layout.HeaderContent>
            <DetailsPageBreadcrumbs orgId={orgId} event={event} eventSlug={eventSlug} />
          </Layout.HeaderContent>
          <ButtonActionsWrapper>
            <FeatureFeedback featureName="replay" buttonProps={{size: 'small'}} />
          </ButtonActionsWrapper>
        </Layout.Header>
        <FullViewportContent>{children}</FullViewportContent>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

// TODO(replay); This could make a lot of sense to put inside HeaderActions by default
const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  justify-content: flex-end;
  gap: ${space(1)};
`;

const FullViewport = styled('div')`
  height: 100vh;
  width: 100%;

  display: flex;
  flex-flow: nowrap column;
  flex-direction: column;
  overflow: hidden;

  /*
   * The footer component is a sibling of this div.
   * Remove it so the replay can take up the
   * entire screen.
   */
  ~ footer {
    display: none;
  }
`;

const FullViewportContent = styled('section')`
  flex-grow: 1;
  background: ${p => p.theme.background};
`;

export default Page;
