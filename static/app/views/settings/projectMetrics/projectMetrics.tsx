import {Fragment, useMemo} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import ExternalLink from 'sentry/components/links/externalLink';
import PanelTable from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Tag from 'sentry/components/tag';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {getReadableMetricType, METRICS_DOCS_URL} from 'sentry/utils/metrics';
import {formatMRI} from 'sentry/utils/metrics/mri';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {middleEllipsis} from 'sentry/utils/middleEllipsis';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

function ProjectMetrics({project, location}: Props) {
  const {data: meta, isLoading} = useMetricsMeta([parseInt(project.id, 10)], ['custom']);
  const query = decodeScalar(location.query.query, '');

  const debouncedSearch = useMemo(
    () =>
      debounce(
        (searchQuery: string) =>
          browserHistory.replace({
            pathname: location.pathname,
            query: {...location.query, query: searchQuery},
          }),
        DEFAULT_DEBOUNCE_DURATION
      ),
    [location.pathname, location.query]
  );

  const metrics = meta
    .sort((a, b) => formatMRI(a.mri).localeCompare(formatMRI(b.mri)))
    .filter(
      ({mri, type, unit}) =>
        mri.includes(query) ||
        getReadableMetricType(type).includes(query) ||
        unit.includes(query)
    );

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(t('Metrics'), project.slug, false)} />
      <SettingsPageHeader title={t('Metrics')} />

      <TextBlock>
        {tct(
          `Metrics are numerical values that can track anything about your environment over time, from latency to error rates to user signups. To learn more about metrics, [link:read the docs].`,
          {
            link: <ExternalLink href={METRICS_DOCS_URL} />,
          }
        )}
      </TextBlock>

      <PermissionAlert project={project} />

      <SearchWrapper>
        <SearchBar
          placeholder={t('Search Metrics')}
          onChange={debouncedSearch}
          query={query}
        />
      </SearchWrapper>

      <StyledPanelTable
        headers={[
          t('Metric'),
          <RightAligned key="type"> {t('Type')}</RightAligned>,
          <RightAligned key="unit">{t('Unit')}</RightAligned>,
        ]}
        emptyMessage={
          query
            ? t('No metrics match the query.')
            : t('There are no custom metrics for this project.')
        }
        isEmpty={metrics.length === 0}
        isLoading={isLoading}
      >
        {metrics.map(({mri, type, unit}) => (
          <Fragment key={mri}>
            <div>{middleEllipsis(formatMRI(mri), 65, /\.|-|_/)}</div>
            <RightAligned>
              <Tag>{getReadableMetricType(type)}</Tag>
            </RightAligned>
            <RightAligned>
              <Tag>{unit}</Tag>
            </RightAligned>
          </Fragment>
        ))}
      </StyledPanelTable>
    </Fragment>
  );
}

const SearchWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr minmax(115px, min-content) minmax(115px, min-content);
`;

const RightAligned = styled('div')`
  text-align: right;
`;

export default ProjectMetrics;
