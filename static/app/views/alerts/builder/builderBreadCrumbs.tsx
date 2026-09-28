import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

interface Props {
  organization: Organization;
  title: string;
}

export function BuilderBreadCrumbs({title, organization}: Props) {
  const location = useLocation();

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: t('Monitors'),
              to: {
                pathname: makeMonitorBasePathname(organization.slug),
                query: extractSelectionParameters(location.query),
              },
            },
          ]}
        />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title item={{type: 'page-title', label: title}} />
      </TopBar.Slot>
    </Fragment>
  );
}
