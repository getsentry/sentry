import React, {Fragment} from 'react';
import styled from '@emotion/styled';

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
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {DomainSelector} from 'sentry/views/insights/common/views/spans/selectors/domainSelector';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

const {SPAN_OP, SPAN_DOMAIN} = BrowserStarfishFields;

function ResourcesLandingPage() {
  const filters = useResourceModuleFilters();

  return (
    <React.Fragment>
      <PageAlertProvider>
        <FrontendHeader
          headerTitle={
            <Fragment>
              {MODULE_TITLE}
              <PageHeadingQuestionTooltip
                docsUrl={MODULE_DOC_LINK}
                title={MODULE_DESCRIPTION}
              />
            </Fragment>
          }
          module={ModuleName.RESOURCE}
        />
        <ModuleBodyUpsellHook moduleName={ModuleName.RESOURCE}>
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
        </ModuleBodyUpsellHook>
      </PageAlertProvider>
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="resource"
      features="insights-initial-modules"
      analyticEventName="insight.page_loads.assets"
    >
      <ResourcesLandingPage />
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
