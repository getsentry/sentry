import {Fragment, startTransition, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta, Project} from 'sentry/types';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {
  getMetricsTagsQueryKey,
  useMetricsTags,
} from 'sentry/utils/metrics/useMetricsTags';
import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const MAX_PROJECTS_TO_SHOW = 3;
const MAX_TAGS_TO_SHOW = 5;

const STANDARD_TAGS = ['release', 'environment', 'transaction'];

export function MetricListItemDetails({
  metric,
  selectedProjects,
}: {
  metric: MetricMeta;
  selectedProjects: Project[];
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const isCustomMetric = parseMRI(metric.mri)?.useCase === 'custom';

  const projectIds = useMemo(
    () => selectedProjects.map(project => parseInt(project.id, 10)),
    [selectedProjects]
  );

  const [isQueryEnabled, setIsQueryEnabled] = useState(() => {
    // We only wnat to disable the query if there is no data in the cache
    const queryKey = getMetricsTagsQueryKey(organization, metric.mri, {
      projects: projectIds,
    });
    const data = queryClient.getQueryData(queryKey);
    return !!data;
  });

  const {data: tagsData = [], isLoading: tagsIsLoading} = useMetricsTags(
    // TODO: improve useMetricsTag interface
    isQueryEnabled ? metric.mri : undefined,
    {
      projects: projectIds,
    }
  );

  useEffect(() => {
    // Start querying tags after a short delay to avoid querying
    // for every metric if a user quickly hovers over them
    const timeout = setTimeout(() => {
      startTransition(() => setIsQueryEnabled(true));
    }, 200);
    return () => clearTimeout(timeout);
  }, []);

  const metricProjects = selectedProjects.filter(project =>
    metric.projectIds.includes(parseInt(project.id, 10))
  );

  const truncatedProjects = metricProjects.slice(0, MAX_PROJECTS_TO_SHOW);
  // Display custom tags first, then sort alphabetically
  const sortedTags = useMemo(
    () =>
      tagsData.toSorted((a, b) => {
        const aIsStandard = STANDARD_TAGS.includes(a.key);
        const bIsStandard = STANDARD_TAGS.includes(b.key);

        if (aIsStandard && !bIsStandard) {
          return 1;
        }
        if (!aIsStandard && bIsStandard) {
          return -1;
        }

        return a.key.localeCompare(b.key);
      }),
    [tagsData]
  );
  const truncatedTags = sortedTags.slice(0, MAX_TAGS_TO_SHOW);

  return (
    <DetailsWrapper>
      <MetricName>
        {/* Add zero width spaces at delimiter characters for nice word breaks */}
        {formatMRI(metric.mri).replaceAll(/([\.\/-_])/g, '\u200b$1')}
        {!isCustomMetric && (
          <SamplingWarning>
            <IconWarning color="yellow400" size="xs" />
            {t('Prone to client-side sampling')}
          </SamplingWarning>
        )}
      </MetricName>
      <DetailsGrid>
        <DetailsLabel>{t('Project')}</DetailsLabel>
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
        <DetailsLabel>{t('Type')}</DetailsLabel>
        <DetailsValue>{getReadableMetricType(metric.type)}</DetailsValue>
        <DetailsLabel>{t('Unit')}</DetailsLabel>
        <DetailsValue>{metric.unit}</DetailsValue>
        <DetailsLabel>{t('Tags')}</DetailsLabel>
        <DetailsValue>
          {tagsIsLoading || !isQueryEnabled ? (
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

const SamplingWarning = styled('div')`
  display: grid;
  gap: ${space(0.25)};
  grid-template-columns: max-content 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.yellow400};
  align-items: center;
`;
