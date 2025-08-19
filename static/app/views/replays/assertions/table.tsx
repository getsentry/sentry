import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {AlertBadge} from 'sentry/components/core/badge/alertBadge';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Input} from 'sentry/components/core/input';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {AssigneeSelector} from 'sentry/components/group/assigneeSelector';
import * as Layout from 'sentry/components/layouts/thirds';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCursorArrow, IconLocation, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useQuery} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {IncidentStatus} from 'sentry/views/alerts/types';
import AssertionDatabase from 'sentry/views/replays/assertions/database';
import type {AssertionFlow} from 'sentry/views/replays/assertions/types';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export default function ReplayOverview() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {projects} = useProjects();

  const {data: flows} = useQuery({
    queryKey: ['/assertions/flows'],
    queryFn: () => {
      return Promise.resolve(Array.from(AssertionDatabase.flows));
    },
  });

  return (
    <AnalyticsArea name="insights.replays">
      <SentryDocumentTitle title={t('Replay Assertions')} orgSlug={organization.slug}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Replay Flows')}
              <PageHeadingQuestionTooltip
                title={t('Assert that users are doing what you expect them to do.')}
                docsUrl="https://docs.sentry.io/product/session-replay/"
              />
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <LinkButton
              priority="primary"
              to={{
                pathname: makeReplaysPathname({
                  path: '/assertions/new/',
                  organization,
                }),
                query: {project: '11276', environment: 'prod'},
              }}
            >
              Create New Flow
            </LinkButton>
          </Layout.HeaderActions>
        </Layout.Header>
        <PageFiltersContainer>
          <Layout.Body>
            <Layout.Main fullWidth>
              <Grid gap="xl">
                <Flex gap="lg" align="center">
                  <PageFilterBar condensed>
                    <ProjectPageFilter resetParamsOnChange={['cursor']} />
                    <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
                  </PageFilterBar>
                  <Input placeholder={t('Search for assertions')} style={{flex: '1'}} />
                </Flex>

                <SimpleTableWithColumns>
                  <SimpleTable.Header>
                    <SimpleTable.HeaderCell>Name</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>Assertions</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>Created</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>Last Seen</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>Status</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>Assignee</SimpleTable.HeaderCell>
                  </SimpleTable.Header>
                  {flows?.map(row => (
                    <SimpleTable.Row
                      key={row.name}
                      onClick={() => {
                        navigate(
                          makeReplaysPathname({
                            path: `/assertions/details/${row.id}/`,
                            organization,
                          })
                        );
                      }}
                    >
                      <InteractionStateLayer />
                      <SimpleTable.RowCell>
                        <FullRowButton
                          priority="link"
                          to={makeReplaysPathname({
                            path: `/assertions/details/${row.id}/`,
                            organization,
                          })}
                        >
                          <Flex gap="md" align="center">
                            <FlowIcon flow={row} />
                            <Flex direction="column" gap="xs">
                              <Text size="md" bold>
                                {row.name}
                              </Text>
                              <Text size="sm" ellipsis>
                                {row.description}
                              </Text>
                              <Flex gap="lg">
                                <Flex gap="xs" align="center">
                                  <ProjectAvatar
                                    size={12}
                                    project={
                                      projects.find(
                                        project => project.id === row.project_id
                                      )!
                                    }
                                  />
                                  <Text size="sm" variant="muted">
                                    {
                                      projects.find(
                                        project => project.id === row.project_id
                                      )!.slug
                                    }
                                  </Text>
                                </Flex>
                                <Text size="sm" variant="muted">
                                  {row.environment}
                                </Text>
                              </Flex>
                            </Flex>
                          </Flex>
                        </FullRowButton>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Grid
                          gap="xs md"
                          columns={'max-content max-content'}
                          justifyItems="end"
                        >
                          <Text>Passing</Text>
                          <Text size="sm">100%</Text>
                          <Text>Unknown</Text>
                          <Text size="sm">0%</Text>
                        </Grid>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <TimeSince date={row.created_at} />
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <TimeSince date={row.created_at} />
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <AlertBadge
                          withText
                          status={
                            row.status === 'success'
                              ? IncidentStatus.OPENED
                              : IncidentStatus.CLOSED
                          }
                        />
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <AssigneeSelector
                          showLabel
                          group={
                            {
                              project: {
                                slug: 'javascript',
                              },
                            } as any
                          }
                          owners={undefined}
                          assigneeLoading={false}
                          handleAssigneeChange={() => {}}
                        />
                      </SimpleTable.RowCell>
                    </SimpleTable.Row>
                  ))}
                </SimpleTableWithColumns>

                <PaginationNoMargin pageLinks={''} />
              </Grid>
            </Layout.Main>
          </Layout.Body>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}

function FlowIcon({flow}: {flow: AssertionFlow}) {
  const startingAction = flow.starting_action;
  if (startingAction.type === 'breadcrumb') {
    switch (startingAction.matcher.category) {
      case 'ui.click':
        return <IconCursorArrow color="blue300" size="md" />;
      case 'navigation':
        return <IconLocation color="green300" size="md" />;
      default:
        return <IconTerminal color="blue300" size="md" />;
    }
  } else if (startingAction.type === 'span') {
    switch (startingAction.matcher.op) {
      case 'navigation.navigate':
        return <IconLocation color="green300" size="md" />;
      default:
        return <IconTerminal color="blue300" size="md" />;
    }
  }
  return <IconTerminal color="gray300" size="md" />;
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr repeat(5, max-content);
`;

const FullRowButton = styled(LinkButton)`
  font-weight: normal;
  width: 100%;
  text-align: left;
  align-items: flex-start;
  flex-direction: column;
  flex: 1;

  margin: -${p => p.theme.space.lg} -${p => p.theme.space.xl};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
`;

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
