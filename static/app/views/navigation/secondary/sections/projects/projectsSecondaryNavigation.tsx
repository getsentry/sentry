import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {ProjectsNavigationItems} from 'sentry/views/navigation/secondary/sections/projects/starredProjectsList';

export function ProjectsSecondaryNavigation() {
  return (
    <Fragment>
      <SecondaryNavigation.HeaderWithSidebarToggle>
        {t('Projects')}
      </SecondaryNavigation.HeaderWithSidebarToggle>
      <SecondaryNavigation.Body>
        <ProjectsNavigationItems />
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
