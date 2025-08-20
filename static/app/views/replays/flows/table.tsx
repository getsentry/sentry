import {useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import AnalyticsArea from 'sentry/components/analyticsArea';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {AlertBadge} from 'sentry/components/core/badge/alertBadge';
import {Button} from 'sentry/components/core/button';
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
import useAssertionPageCrumbs from 'sentry/components/replays/flows/assertionPageCrumbs';
import AssertionReplayPlayer from 'sentry/components/replays/flows/assertionReplayPlayer';
import NewFlowSlideoutPanel from 'sentry/components/replays/flows/newFlowSlideoutPanel';
import PreviewModalContainer from 'sentry/components/replays/flows/previewModalContainer';
import {
  SelectedReplayIndexProvider,
  useSelectedReplayIndex,
} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCursorArrow, IconLocation, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useMutation, useQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import AssertionDatabase from 'sentry/utils/replays/assertions/database';
import type {AssertionAction, AssertionFlow} from 'sentry/utils/replays/assertions/types';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {IncidentStatus} from 'sentry/views/alerts/types';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export default function FlowTable() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {projects} = useProjects();

  const [isNewFlowOpen, setIsNewFlowOpen] = useState(false);

  const crumbs = useAssertionPageCrumbs();

  const {data: flows} = useQuery({
    queryKey: ['/flows/all/'],
    queryFn: () => {
      return Promise.resolve(Array.from(AssertionDatabase.flows));
    },
  });

  const {mutate: createFlow} = useMutation({
    mutationFn: (value: AssertionFlow) => {
      AssertionDatabase.restore();
      AssertionDatabase.flows.add(value);
      AssertionDatabase.persist();
      return Promise.resolve(value);
    },
    onSuccess: flow => {
      addSuccessMessage(t('Flow created successfully'));
      navigate(
        makeReplaysPathname({
          path: `/flows/details/${flow.id}/`,
          organization,
        })
      );
    },
  });

  const {select: setSelectedReplayIndex} = useSelectedReplayIndex();
  const {selected_replay_id: previewReplayId} = useLocationQuery({
    fields: {
      selected_replay_id: decodeScalar,
    },
  });

  return (
    <AnalyticsArea name="table">
      <SentryDocumentTitle title={t('Replay Assertions')} orgSlug={organization.slug}>
        <div style={{position: 'relative'}}>
          <SelectedReplayIndexProvider>
            {isNewFlowOpen ? (
              <SlideoutPanelContainer>
                <NewFlowSlideoutPanel
                  onClose={() => setIsNewFlowOpen(false)}
                  onSave={createFlow}
                />
              </SlideoutPanelContainer>
            ) : null}
            {previewReplayId ? (
              <PreviewModalContainer onClose={() => setSelectedReplayIndex('', '')}>
                <AssertionReplayPlayer replaySlug={previewReplayId} />
              </PreviewModalContainer>
            ) : null}
          </SelectedReplayIndexProvider>

          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs crumbs={crumbs} style={{padding: 0}} />
              <Layout.Title>
                {t('Replay Flows')}
                <PageHeadingQuestionTooltip
                  title={t('Assert that users are doing what you expect them to do.')}
                  docsUrl="https://docs.sentry.io/product/session-replay/"
                />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <Button priority="primary" onClick={() => setIsNewFlowOpen(true)}>
                {t('Create New Flow')}
              </Button>
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
                      <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
                      <SimpleTable.HeaderCell>{t('Assertions')}</SimpleTable.HeaderCell>
                      <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
                      <SimpleTable.HeaderCell>{t('Last Seen')}</SimpleTable.HeaderCell>
                      <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
                      <SimpleTable.HeaderCell>{t('Assignee')}</SimpleTable.HeaderCell>
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
                            <Text>{t('Passing')}</Text>
                            <Text size="sm">100%</Text>
                            <Text>{t('Unknown')}</Text>
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
        </div>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}

function SlideoutPanelContainer({children}: {children: React.ReactNode}) {
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
      }}
    >
      <AnimatePresence>
        (
        <div
          css={css`
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 100vh;
            z-index: 1000;
          `}
        >
          {children}
        </div>
      </AnimatePresence>
    </div>
  );
}

function getCategoryOrOp(action: AssertionAction): string {
  if ('op' in action) {
    return action.op;
  }
  if ('category' in action) {
    return action.category;
  }
  return 'null';
}

function FlowIcon({flow}: {flow: AssertionFlow}) {
  switch (getCategoryOrOp(flow.starting_action)) {
    case 'ui.click':
      return <IconCursorArrow color="blue300" size="md" />;
    case 'navigation':
      return <IconLocation color="green300" size="md" />;
    case 'navigation.navigate':
      return <IconLocation color="green300" size="md" />;
    default:
      return <IconTerminal color="blue300" size="md" />;
  }
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
