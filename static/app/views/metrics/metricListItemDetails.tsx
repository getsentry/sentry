import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta, Project} from 'sentry/types';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI} from 'sentry/utils/metrics/mri';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';

const MAX_PROJECTS_TO_SHOW = 3;
const MAX_TAGS_TO_SHOW = 5;

export function MetricListItemDetails({
  metric,
  selectedProjects,
}: {
  metric: MetricMeta;
  selectedProjects: Project[];
}) {
  const {data: tagsData = [], isLoading: tagsIsLoading} = useMetricsTags(metric.mri, {
    projects: selectedProjects.map(project => parseInt(project.id, 10)),
  });

  const metricProjects = selectedProjects.filter(project =>
    metric.projectIds.includes(parseInt(project.id, 10))
  );

  const truncatedProjects = metricProjects.slice(0, MAX_PROJECTS_TO_SHOW);
  const truncatedTags = tagsData.slice(0, MAX_TAGS_TO_SHOW);

  return (
    <DetailsWrapper>
      <MetricName>
        {/* Add zero width spaces at delimiter like characters for nice word breaks */}
        {formatMRI(metric.mri).replaceAll(/([\.\/-_])/g, '\u200b$1')}
      </MetricName>
      <DetailsGrid>
        <DetailsLabel>Project</DetailsLabel>
        <DetailsValue>
          {truncatedProjects.map(project => (
            <ProjectBadge
              project={project}
              key={project.slug}
              avatarSize={12}
              disableLink
            />
          ))}
          {metricProjects.length > MAX_PROJECTS_TO_SHOW && (
            <span>{t('+%d more', metricProjects.length - MAX_PROJECTS_TO_SHOW)}</span>
          )}
        </DetailsValue>
        <DetailsLabel>Type</DetailsLabel>
        <DetailsValue>{getReadableMetricType(metric.type)}</DetailsValue>
        <DetailsLabel>Unit</DetailsLabel>
        <DetailsValue>{metric.unit}</DetailsValue>
        <DetailsLabel>Tags</DetailsLabel>
        <DetailsValue>
          {tagsIsLoading ? (
            <StyledLoadingIndicator mini size={12} />
          ) : truncatedTags.length === 0 ? (
            t('(None)')
          ) : (
            <Fragment>
              {truncatedTags.map(tag => tag.key).join(', ')}
              {tagsData.length > MAX_TAGS_TO_SHOW && (
                <div>{t('+%d more', tagsData.length - MAX_TAGS_TO_SHOW)}</div>
              )}
            </Fragment>
          )}
        </DetailsValue>
      </DetailsGrid>
    </DetailsWrapper>
  );
}

const DetailsWrapper = styled('div')`
  width: 300px;
  line-height: 1.4;
`;

const MetricName = styled('div')`
  padding: ${space(0.75)} ${space(1.5)};
  word-break: break-word;
`;

const DetailsGrid = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;

  & > div:nth-child(4n + 1),
  & > div:nth-child(4n + 2) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: ${space(0.75)} 0 0;
    height: 12px;
    width: 12px;
  }
`;

const DetailsLabel = styled('div')`
  color: ${p => p.theme.subText};
  padding: ${space(0.75)} ${space(1)} ${space(0.75)} ${space(1.5)};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
`;

const DetailsValue = styled('div')`
  white-space: pre-wrap;
  padding: ${space(0.75)} ${space(1.5)} ${space(0.75)} ${space(1)};
  border-top-right-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  min-width: 0;
`;
