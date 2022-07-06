import {Fragment} from 'react';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

type Props = {
  eventSlug: string;
  orgId: string;
  event?: Event;
};

function getUsernameFromEvent({eventSlug, event}: Pick<Props, 'event' | 'eventSlug'>) {
  const user = event?.user;

  if (!user) {
    return eventSlug;
  }

  return user.name || user.email || user.username || user.ip_address;
}

function DetailsPageBreadcrumbs({orgId, event, eventSlug}: Props) {
  const username = getUsernameFromEvent({event, eventSlug});

  return (
    <Breadcrumbs
      crumbs={[
        {
          to: `/organizations/${orgId}/replays/`,
          label: t('Replays'),
        },
        {
          label: (
            <Fragment>
              {username}
              <FeatureBadge type="alpha" />
            </Fragment>
          ),
        },
      ]}
    />
  );
}

export default DetailsPageBreadcrumbs;
