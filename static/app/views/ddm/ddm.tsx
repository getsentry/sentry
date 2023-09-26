import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defaultMetricDisplayType, MetricDisplayType} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import MetricsExplorer from 'sentry/views/ddm/metricsExplorer';

function DDM() {
  const organization = useOrganization();
  const router = useRouter();

  return (
    <SentryDocumentTitle title={t('DDM')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                {t('DDM')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io"
                  title={t('Delightful Developer Metrics.')}
                />
                <FeatureBadge type="alpha" />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <FeatureFeedback featureName="DDM" buttonProps={{size: 'sm'}} />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              <PaddedContainer>
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
                <CompactSelect
                  triggerProps={{prefix: t('Display')}}
                  value={router.location.query.display ?? defaultMetricDisplayType}
                  options={[
                    {
                      value: MetricDisplayType.LINE,
                      label: t('Line Chart'),
                    },
                    {
                      value: MetricDisplayType.AREA,
                      label: t('Area Chart'),
                    },
                    {
                      value: MetricDisplayType.BAR,
                      label: t('Bar Chart'),
                    },
                  ]}
                  onChange={({value}) => {
                    router.push({
                      ...router.location,
                      query: {
                        ...router.location.query,
                        cursor: undefined,
                        display: value,
                      },
                    });
                  }}
                />
              </PaddedContainer>
              <MetricsExplorer />
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: grid;
  grid-template: 1fr / 1fr max-content;
  gap: ${space(1)};
  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template: 1fr 1fr / 1fr;
  }
`;

export default DDM;
