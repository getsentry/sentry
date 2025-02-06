import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: React.ReactNode;
};

export default function ExploreNavigation({children}: Props) {
  const organization = useOrganization();
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

  if (!hasNavigationV2) {
    return children;
  }

  const baseUrl = `/organizations/${organization.slug}/explore`;

  // TODO(malwilley): Move other products under the /explore/ route
  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.EXPLORE}>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <Feature features="performance-trace-explorer">
              <SecondaryNav.Item to={`${baseUrl}/traces/`}>
                {t('Traces')}
              </SecondaryNav.Item>
            </Feature>
            <Feature features="ourlogs-enabled">
              <SecondaryNav.Item to={`${baseUrl}/logs/`}>{t('Logs')}</SecondaryNav.Item>
            </Feature>
            <Feature features="profiling">
              <SecondaryNav.Item to={`${baseUrl}/profiling/`}>
                {t('Profiles')}
              </SecondaryNav.Item>
            </Feature>
            <Feature features="session-replay-ui">
              <SecondaryNav.Item to={`${baseUrl}/replays/`}>
                {t('Replays')}
              </SecondaryNav.Item>
            </Feature>
            <Feature features="discover-basic">
              <SecondaryNav.Item to={`${baseUrl}/discover/`}>
                {t('Discover')}
              </SecondaryNav.Item>
            </Feature>
            <SecondaryNav.Item to={`${baseUrl}/releases/`}>
              {t('Releases')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        </SecondaryNav.Body>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}
