import React, {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {DEFAULT_RESOURCE_FILTERS} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import ResourceView from 'sentry/views/insights/browser/resources/components/resourceView';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/insights/browser/resources/settings';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {DomainSelector} from 'sentry/views/insights/common/views/spans/selectors/domainSelector';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {ModuleName} from 'sentry/views/insights/types';

const {SPAN_OP, SPAN_DOMAIN} = BrowserStarfishFields;

function ResourcesLandingPage() {
  const filters = useResourceModuleFilters();

  return (
    <React.Fragment>
      <PageAlertProvider>
        <ModuleFeature moduleName={ModuleName.RESOURCE}>
          <Layout.Body>
            <Layout.Main width="full">
              <PageAlert />
              <StyledHeaderContainer>
                <ToolRibbon>
                  <ModulePageFilterBar
                    moduleName={ModuleName.RESOURCE}
                    extraFilters={
                      <Fragment>
                        <DomainSelector
                          domainAlias={t('Domain')}
                          moduleName={ModuleName.RESOURCE}
                          emptyOptionLocation="top"
                          value={filters[SPAN_DOMAIN] || ''}
                          additionalQuery={[
                            ...DEFAULT_RESOURCE_FILTERS.filter(
                              filter => filter !== 'has:sentry.normalized_description'
                            ),
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
        </ModuleFeature>
      </PageAlertProvider>
    </React.Fragment>
  );
}

function PageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName="resource"
      analyticEventName="insight.page_loads.assets"
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <ResourcesLandingPage />
    </ModulePageProviders>
  );
}

const StyledHeaderContainer = styled(HeaderContainer)`
  margin-bottom: ${space(2)};
`;

export default PageWithProviders;
