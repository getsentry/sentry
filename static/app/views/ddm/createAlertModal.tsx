import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {AreaChart} from 'sentry/components/charts/areaChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import CircleIndicator from 'sentry/components/circleIndicator';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import {formatMRIField, MRIToField} from 'sentry/utils/metrics/mri';
import {useMetricsData} from 'sentry/utils/metrics/useMetricsData';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getChartSeries} from 'sentry/views/ddm/widget';

interface Props extends ModalRenderProps {
  metricsQuery: MetricsQuery;
}

interface FormState {
  environment: string | null;
  project: string | null;
}

function getInitialFormState(metricsQuery: MetricsQuery): FormState {
  const project =
    metricsQuery.projects.length === 1 ? metricsQuery.projects[0].toString() : null;
  const environment =
    metricsQuery.environments.length === 1 && project
      ? metricsQuery.environments[0]
      : null;

  return {
    project,
    environment,
  };
}

export function CreateAlertModal({Header, Body, Footer, metricsQuery}: Props) {
  const router = useRouter();
  const organization = useOrganization();
  const {projects} = useProjects();
  const [formState, setFormState] = useState<FormState>(() =>
    getInitialFormState(metricsQuery)
  );

  const projectOptions = useMemo(() => {
    const nonMemberProjects: Project[] = [];
    const memberProjects: Project[] = [];
    projects.forEach(project =>
      project.isMember ? memberProjects.push(project) : nonMemberProjects.push(project)
    );

    return [
      {
        label: t('My Projects'),
        options: memberProjects.map(p => ({
          value: p.id,
          label: p.slug,
          leadingItems: <ProjectBadge project={p} avatarSize={16} hideName disableLink />,
        })),
      },
      {
        label: t('All Projects'),
        options: nonMemberProjects.map(p => ({
          value: p.id,
          label: p.slug,
          leadingItems: <ProjectBadge project={p} avatarSize={16} hideName disableLink />,
        })),
      },
    ];
  }, [projects]);

  const selectedProject = projects.find(p => p.id === formState.project);

  const isFormValid = formState.project !== null;

  const {data, isLoading, refetch, isError} = useMetricsData({
    mri: metricsQuery.mri,
    op: metricsQuery.op,
    projects: formState.project ? [parseInt(formState.project, 10)] : [],
    environments: formState.environment ? [formState.environment] : [],
    datetime: metricsQuery.datetime,
    query: metricsQuery.query,
  });

  const handleSubmit = () => {
    router.push(
      `/organizations/${organization.slug}/alerts/new/metric/?${qs.stringify({
        // Needed, so alerts-create also collects environment via event view
        createFromDiscover: true,
        dataset: Dataset.GENERIC_METRICS,
        eventTypes: EventTypes.TRANSACTION,
        aggregate: MRIToField(metricsQuery.mri, metricsQuery.op!),
        referrer: 'ddm',
        // Event type also needs to be added to the query
        query: `${metricsQuery.query}  event.type:transaction`.trim(),
        environment: formState.environment ?? undefined,
        project: selectedProject!.slug,
      })}`
    );
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Create Alert')}</h4>
      </Header>
      <Body>
        <ContentWrapper>
          <SelectControl
            placeholder={t('Select a project')}
            options={projectOptions}
            value={formState.project}
            onChange={({value}) =>
              setFormState(prev => ({
                project: value,
                environment: projects
                  .find(p => p.id === value)
                  ?.environments.includes(prev.environment ?? '')
                  ? prev.environment
                  : null,
              }))
            }
          />
          <SelectControl
            placeholder={t('Select an environment')}
            options={[
              {
                value: null,
                label: t('All Environments'),
              },
              ...(selectedProject?.environments.map(env => ({
                value: env,
                label: env,
              })) ?? []),
            ]}
            disabled={!selectedProject}
            value={formState.environment}
            onChange={({value}) => setFormState(prev => ({...prev, environment: value}))}
          />
          <div>
            {t(
              'Grouped series are not supported by alerts. This is a preview of the data the alert will use.'
            )}
          </div>

          <ChartPanel isLoading={isLoading}>
            <PanelBody withPadding>
              <ChartHeader>
                <HeaderTitleLegend>
                  {AlertWizardAlertNames.custom_metrics}
                </HeaderTitleLegend>
              </ChartHeader>
              <ChartFilters>
                <StyledCircleIndicator size={8} />
                <Tooltip
                  title={
                    <Fragment>
                      <Filters>
                        {formatMRIField(MRIToField(metricsQuery.mri, metricsQuery.op!))}
                      </Filters>
                      {metricsQuery.query}
                    </Fragment>
                  }
                  isHoverable
                  skipWrapper
                  overlayStyle={{
                    maxWidth: '90vw',
                    lineBreak: 'anywhere',
                    textAlign: 'left',
                  }}
                  showOnlyOnOverflow
                >
                  <QueryFilters>
                    <Filters>
                      {formatMRIField(MRIToField(metricsQuery.mri, metricsQuery.op!))}
                    </Filters>
                    {metricsQuery.query}
                  </QueryFilters>
                </Tooltip>
              </ChartFilters>
            </PanelBody>
            {isLoading && <StyledLoadingIndicator />}
            {isError && <LoadingError onRetry={refetch} />}
            {data && (
              <AreaChart
                series={getChartSeries(data, {
                  displayType: MetricDisplayType.AREA,
                  focusedSeries: undefined,
                  groupBy: [],
                  hoveredLegend: undefined,
                })}
                isGroupedByDate
                height={200}
                grid={{top: 20, bottom: 20, left: 15, right: 25}}
              />
            )}
          </ChartPanel>
        </ContentWrapper>
      </Body>
      <Footer>
        <Tooltip disabled={isFormValid} title={t('Please select a project')}>
          <Button priority="primary" disabled={!isFormValid} onClick={handleSubmit}>
            {t('Create Alert')}
          </Button>
        </Tooltip>
      </Footer>
    </Fragment>
  );
}

const ContentWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};
`;

const ChartPanel = styled(Panel)<{isLoading: boolean}>`
  ${p =>
    p.isLoading &&
    `
    opacity: 0.6;
  `}
`;

const ChartHeader = styled('div')`
  margin-bottom: ${space(3)};
`;

const StyledCircleIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.formText};
  height: ${space(1)};
  margin-right: ${space(0.5)};
`;

const ChartFilters = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.textColor};
  display: inline-grid;
  grid-template-columns: max-content auto;
  align-items: center;
`;

const Filters = styled('span')`
  margin-right: ${space(1)};
`;

const QueryFilters = styled('span')`
  min-width: 0px;
  ${p => p.theme.overflowEllipsis}
`;

// Totals to a height of 200px -> the height of the chart
const StyledLoadingIndicator = styled(LoadingIndicator)`
  height: 64px;
  margin-top: 58px;
  margin-bottom: 78px;
`;
