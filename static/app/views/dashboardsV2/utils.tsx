import React from 'react';
import cloneDeep from 'lodash/cloneDeep';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {GlobalSelection, Organization} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';

import {DashboardDetails, WidgetQuery} from './types';

export function cloneDashboard(dashboard: DashboardDetails): DashboardDetails {
  return cloneDeep(dashboard);
}

export function eventViewFromWidget(
  title: string,
  query: WidgetQuery,
  selection: GlobalSelection
): EventView {
  const {start, end, period: statsPeriod} = selection.datetime;
  const {projects, environments} = selection;

  return EventView.fromSavedQuery({
    id: undefined,
    name: title,
    version: 2,
    fields: query.fields,
    query: query.conditions,
    orderby: query.orderby,
    projects,
    range: statsPeriod,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
    environment: environments,
  });
}

type FeatureProps = {
  organization: Organization;
  children: React.ReactNode;
};

export const DashboardBasicFeature = ({organization, children}: FeatureProps) => {
  const renderDisabled = () => (
    <PageContent>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </PageContent>
  );

  return (
    <Feature
      features={['organizations:dashboards-basic']}
      organization={organization}
      renderDisabled={renderDisabled}
    >
      {children}
    </Feature>
  );
};
