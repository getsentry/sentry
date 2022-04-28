import React from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getUrlPathname from 'sentry/utils/getUrlPathname';

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
                  label: (
                    <React.Fragment>
                      {t('Replays')}
                      <FeatureBadge type="alpha" />
                    </React.Fragment>
                  ),
                },
                {
                  label: event
                    ? generateEventSlug({
                        project: event.projectSlug,
                        id: event.id,
                      })
                    : t('Replay'),
                },
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

  const urlTag = event.tags.find(({key}) => key === 'url');
  const pathname = getUrlPathname(urlTag?.value ?? '') ?? '';

  return (
    <EventHeaderContainer data-test-id="event-header">
      <UserBadge
        avatarSize={32}
        user={{
          username: event.user?.username ?? '',
          id: event.user?.id ?? '',
          ip_address: event.user?.ip_address ?? '',
          name: event.user?.name ?? '',
          email: event.user?.email ?? '',
        }}
        // this is the subheading for the avatar, so displayEmail in this case is a misnomer
        displayEmail={pathname}
      />
    </EventHeaderContainer>
  );
}

const EventHeaderContainer = styled('div')`
  max-width: ${p => p.theme.breakpoints[0]};
  margin-top: ${space(1)};
`;

export default DetailLayout;
