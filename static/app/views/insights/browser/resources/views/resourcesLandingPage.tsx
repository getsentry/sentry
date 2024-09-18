import React, {Fragment} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {DEFAULT_RESOURCE_FILTERS} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import ResourceView from 'sentry/views/insights/browser/resources/components/resourceView';
import {
  DEFAULT_RESOURCE_TYPES,
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/browser/resources/settings';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {DomainSelector} from 'sentry/views/insights/common/views/spans/selectors/domainSelector';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {type InsightLandingProps, ModuleName} from 'sentry/views/insights/types';

const {SPAN_OP, SPAN_DOMAIN} = BrowserStarfishFields;

function ResourcesLandingPage({disableHeader}: InsightLandingProps) {
  const filters = useResourceModuleFilters();
  const crumbs = useModuleBreadcrumbs('resource');

  return (
    <React.Fragment>
      <PageAlertProvider>
        {!disableHeader && (
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs crumbs={crumbs} />

              <Layout.Title>
                {MODULE_TITLE}
                <PageHeadingQuestionTooltip
                  docsUrl={MODULE_DOC_LINK}
                  title={MODULE_DESCRIPTION}
                />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <FeedbackWidgetButton />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
        )}
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageAlert />
            <StyledHeaderContainer>
              <ToolRibbon>
                <ModulePageFilterBar
                  moduleName={ModuleName.RESOURCE}
                  extraFilters={
                    <Fragment>
                      <DomainSelector
                        moduleName={ModuleName.RESOURCE}
                        emptyOptionLocation="top"
                        value={filters[SPAN_DOMAIN] || ''}
                        additionalQuery={[
                          ...DEFAULT_RESOURCE_FILTERS,
                          `${SPAN_OP}:[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
                        ]}
                      />
                      <SubregionSelector />
                    </Fragment>
                  }
                />
              </ToolRibbon>
            </StyledHeaderContainer>
            <ModulesOnboarding moduleName={ModuleName.RESOURCE}>
              <ResourceView />
            </ModulesOnboarding>
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </React.Fragment>
  );
}

function PageWithProviders(props: InsightLandingProps) {
  return (
    <ModulePageProviders
      moduleName="resource"
      features="insights-initial-modules"
      analyticEventName="insight.page_loads.assets"
    >
      <ResourcesLandingPage {...props} />
    </ModulePageProviders>
  );
}

const StyledHeaderContainer = styled(HeaderContainer)`
  margin-bottom: ${space(2)};
`;

export default PageWithProviders;

export const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
