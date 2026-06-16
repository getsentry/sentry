import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {ProjectsNavigationItems} from 'sentry/views/navigation/secondary/sections/projects/starredProjectsList';

export function ProjectsSecondaryNavigation() {
  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Projects')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <ProjectsNavigationItems />
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
