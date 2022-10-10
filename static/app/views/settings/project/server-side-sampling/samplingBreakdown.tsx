import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {HeaderTitle} from 'sentry/components/charts/styles';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {percent} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import useProjects from 'sentry/utils/useProjects';
import ColorBar from 'sentry/views/performance/vitalDetail/colorBar';

import {useDistribution} from './utils/useDistribution';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from './utils';

type Props = {
  orgSlug: Organization['slug'];
};

export function SamplingBreakdown({orgSlug}: Props) {
  const theme = useTheme();
  const {distribution, loading} = useDistribution();
  const projectBreakdown = distribution?.projectBreakdown;

  const {projects} = useProjects({
    slugs: projectBreakdown?.map(project => project.project) ?? [],
    orgId: orgSlug,
  });
  const totalCount = projectBreakdown?.reduce(
    (acc, project) => acc + project['count()'],
    0
  );
  const projectsWithPercentages = projects
    .map(project => ({
      project,
      percentage: percent(
        projectBreakdown?.find(pb => pb.project === project.slug)?.['count()'] ?? 0,
        totalCount ?? 0
      ),
    }))
    .sort((a, z) => z.percentage - a.percentage);

  function projectWithPercentage(project: Project, percentage: number) {
    return (
      <ProjectWithPercentage key={project.slug}>
        <StyledProjectBadge project={project} avatarSize={16} />
        {formatPercentage(percentage / 100)}
      </ProjectWithPercentage>
    );
  }

  return (
    <Panel>
      <PanelBody withPadding>
        <TitleWrapper>
          <HeaderTitle>{t('Transaction Breakdown')}</HeaderTitle>
          <QuestionTooltip
            title={tct(
              'Shows which projects are affected by the sampling decisions this project makes. [learnMore: Learn more]',
              {
                learnMore: (
                  <ExternalLink
                    href={`${SERVER_SIDE_SAMPLING_DOC_LINK}#traces--propagation-of-sampling-decisions`}
                  />
                ),
              }
            )}
            size="sm"
            isHoverable
          />
        </TitleWrapper>

        {loading ? (
          <Fragment>
            <Placeholder height="16px" bottomGutter={1.5} />
            <Placeholder height="21px" width="250px" />
          </Fragment>
        ) : (
          <Fragment>
            <ColorBar
              colorStops={projectsWithPercentages.map(({project, percentage}, index) => ({
                color: theme.charts.getColorPalette(projectsWithPercentages.length)[
                  index
                ],
                percent: percentage,
                renderBarStatus: (barStatus, key) => (
                  <Tooltip
                    title={projectWithPercentage(project, percentage)}
                    skipWrapper
                    isHoverable
                    key={key}
                  >
                    {barStatus}
                  </Tooltip>
                ),
              }))}
            />
            {projectsWithPercentages.length ? (
              <Projects>
                {projectsWithPercentages.map(({project, percentage}) =>
                  projectWithPercentage(project, percentage)
                )}
              </Projects>
            ) : (
              <EmptyMessage>
                {tct(
                  'This project made no [samplingDecisions] within the last 30 days.',
                  {
                    samplingDecisions: (
                      <Tooltip
                        title={tct(
                          'The first transaction in a trace makes the sampling decision for all following transactions. [learnMore: Learn more]',
                          {
                            learnMore: (
                              <ExternalLink
                                href={`${SERVER_SIDE_SAMPLING_DOC_LINK}#traces--propagation-of-sampling-decisions`}
                              />
                            ),
                          }
                        )}
                        showUnderline
                        isHoverable
                      >
                        {t('sampling decisions')}
                      </Tooltip>
                    ),
                  }
                )}
              </EmptyMessage>
            )}
          </Fragment>
        )}
      </PanelBody>
    </Panel>
  );
}

const TitleWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(1.5)};
`;

const Projects = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1.5)};
  justify-content: flex-start;
  align-items: center;
  margin-top: ${space(1.5)};
`;

const ProjectWithPercentage = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const EmptyMessage = styled('div')`
  display: flex;
  align-items: center;
  min-height: 25px;
  color: ${p => p.theme.subText};
`;

const StyledProjectBadge = styled(ProjectBadge)`
  max-width: 100%;
  overflow: hidden;
`;
