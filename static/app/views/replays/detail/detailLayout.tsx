import React from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import {getMessage} from 'sentry/utils/events';

type Props = {
  children: React.ReactNode;
  event: Event | undefined;
  orgId: string;
};

function DetailLayout({children, event, orgId}: Props) {
  const title = event ? `${event.id} - Replays - ${orgId}` : `Replays - ${orgId}`;

  return (
    <SentryDocumentTitle title={title}>
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  to: `/organizations/${orgId}/replays/`,
                  label: t('Replays'),
                },
                {label: t('Replay Details')}, // TODO(replay): put replay ID or something here
              ]}
            />
            <EventHeader event={event} />
          </Layout.HeaderContent>
        </Layout.Header>
        {children}
      </React.Fragment>
    </SentryDocumentTitle>
  );
}

function EventHeader({event}: Pick<Props, 'event'>) {
  if (!event) {
    return null;
  }
  const message = getMessage(event);
  return (
    <EventHeaderContainer data-test-id="event-header">
      <TitleWrapper>
        <EventOrGroupTitle data={event} />
        <FeatureBadge type="alpha" />
      </TitleWrapper>
      {message && (
        <MessageWrapper>
          <EventMessage message={message} />
        </MessageWrapper>
      )}
    </EventHeaderContainer>
  );
}

const EventHeaderContainer = styled('div')`
  max-width: ${p => p.theme.breakpoints[0]};
`;

const TitleWrapper = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin-top: ${space(3)};
`;

const MessageWrapper = styled('div')`
  margin-top: ${space(1)};
`;

export default DetailLayout;
