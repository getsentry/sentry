import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';

export function InboxSecondaryNavigation() {
  const organization = useOrganization();

  if (!organization.features.includes('universal-inbox')) {
    return null;
  }

  return (
    <Fragment>
      <SecondaryNavigation.Header>
        <SecondaryNavigation.HeaderTitle>{t('Inbox')}</SecondaryNavigation.HeaderTitle>
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="inbox-main">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`/organizations/${organization.slug}/inbox/`}
                analyticsItemName="inbox_all"
              >
                {t('All Items')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
