import React from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {space} from 'sentry/styles/space';
import {RateUnit} from 'sentry/utils/discover/fields';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import useOrganization from 'sentry/utils/useOrganization';
import ResourceView, {
  DEFAULT_RESOURCE_TYPES,
  FilterOptionsContainer,
} from 'sentry/views/performance/browser/resources/resourceView';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  PERFORMANCE_MODULE_DESCRIPTION,
} from 'sentry/views/performance/browser/resources/settings';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {DEFAULT_RESOURCE_FILTERS} from 'sentry/views/performance/browser/resources/utils/useResourcesQuery';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useModuleBreadcrumbs} from 'sentry/views/performance/utils/useModuleBreadcrumbs';
import {useModuleTitle} from 'sentry/views/performance/utils/useModuleTitle';
import {ModuleName} from 'sentry/views/starfish/types';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';

const {SPAN_OP, SPAN_DOMAIN} = BrowserStarfishFields;

export const RESOURCE_THROUGHPUT_UNIT = RateUnit.PER_MINUTE;

function ResourcesLandingPage() {
  const filters = useResourceModuleFilters();
  const organization = useOrganization();
  const moduleTitle = useModuleTitle(ModuleName.RESOURCE);

  const crumbs = useModuleBreadcrumbs('resource');
  const isInsightsEnabled = organization.features.includes('performance-insights');

  return (
    <React.Fragment>
      <PageAlertProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />

            <Layout.Title>
              {moduleTitle}
              <PageHeadingQuestionTooltip
                docsUrl={MODULE_DOC_LINK}
                title={
                  isInsightsEnabled ? MODULE_DESCRIPTION : PERFORMANCE_MODULE_DESCRIPTION
                }
              />
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageAlert />
            <FilterOptionsContainer columnCount={2}>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <DomainSelector
                emptyOptionLocation="top"
                value={filters[SPAN_DOMAIN] || ''}
                additionalQuery={[
                  ...DEFAULT_RESOURCE_FILTERS,
                  `${SPAN_OP}:[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
                ]}
                moduleName={ModuleName.RESOURCE}
              />
            </FilterOptionsContainer>
            <ResourceView />
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="resource" features="insights-initial-modules">
      <ResourcesLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

export const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
