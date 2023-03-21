import {Fragment} from 'react';
import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Button, ButtonProps} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {PanelTable} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {decodeScalar} from 'sentry/utils/queryString';
import withRouteAnalytics, {
  WithRouteAnalyticsProps,
} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import AsyncView from 'sentry/views/asyncView';

type Props = AsyncView['props'] &
  WithRouteAnalyticsProps &
  WithRouterProps<{}> & {
    organization: Organization;
  };

type State = AsyncView['state'] & {};

function NewMonitorButton(props: ButtonProps) {
  const organization = useOrganization();
  return (
    <Button
      to={`/organizations/${organization.slug}/crons/create/`}
      priority="primary"
      {...props}
    >
      {props.children}
    </Button>
  );
}

class Starfishes extends AsyncView<Props, State> {
  get orgSlug() {
    return this.props.organization.slug;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {location} = this.props;
    return [
      [
        'monitorList',
        `/organizations/${this.orgSlug}/monitors/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    return `Crons - ${this.orgSlug}`;
  }

  onRequestSuccess(response): void {
    this.props.setEventNames('monitors.page_viewed', 'Monitors: Page Viewed');
    this.props.setRouteAnalyticsParams({
      empty_state: response.data.length === 0,
    });
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;
    router.push({
      pathname: location.pathname,
      query: normalizeDateTimeParams({
        ...(location.query || {}),
        query,
      }),
    });
  };

  renderBody() {
    const {monitorList} = this.state;
    const {organization} = this.props;

    return (
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Application')}
              <PageHeadingQuestionTooltip
                title={t(
                  'Scheduled monitors that check in on recurring jobs and tell you if they’re running on schedule, failing, or succeeding.'
                )}
                docsUrl="https://docs.sentry.io/product/crons/"
              />
              <FeatureBadge type="beta" />
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <NewMonitorButton size="sm" icon={<IconAdd isCircled size="xs" />}>
                {t('Add Monitor')}
              </NewMonitorButton>
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <Filters>
              <ProjectPageFilter resetParamsOnChange={['cursor']} />
              <SearchBar
                query={decodeScalar(qs.parse(location.search)?.query, '')}
                placeholder={t('Search by name')}
                onSearch={this.handleSearch}
              />
            </Filters>
            {monitorList?.length ? (
              <Fragment>
                <StyledPanelTable
                  headers={[
                    t('Trace'),
                    t('TPM'),
                    t('P75 Change'),
                    t('Error Rate'),
                    t('Operation Breakdown'),
                    t('Actions'),

                    t('Users'),
                    t('Issues'),
                    t('Replay'),
                    t('Crux'),
                  ]}
                />
              </Fragment>
            ) : (
              <OnboardingPanel image={<img src={onboardingImg} />}>
                <h3>{t('Let Sentry monitor your recurring jobs')}</h3>
                <p>
                  {t(
                    "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
                  )}
                </p>
                <ButtonList gap={1}>
                  <NewMonitorButton>{t('Set up first cron monitor')}</NewMonitorButton>
                  <Button href="https://docs.sentry.io/product/crons" external>
                    {t('Read docs')}
                  </Button>
                </ButtonList>
              </OnboardingPanel>
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }
}

const Filters = styled('div')`
  display: grid;
  grid-template-columns: minmax(auto, 300px) 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr max-content max-content max-content max-content max-content;
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default withRouteAnalytics(withSentryRouter(withOrganization(Starfishes)));
