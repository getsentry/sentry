import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  handleSearchQuery: (query: string) => void;
  organization: Organization;
  query: string;
};

function ReplaysFilters({organization, handleSearchQuery, query}: Props) {
  return (
    <FilterContainer>
      <PageFilterBar condensed>
        <ProjectPageFilter resetParamsOnChange={['cursor']} />
        <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
        <DatePageFilter alignDropdown="left" resetParamsOnChange={['cursor']} />
      </PageFilterBar>
      <SearchBar
        organization={organization}
        defaultQuery=""
        query={query}
        placeholder={t('Search')}
        onSearch={handleSearchQuery}
        omitTags={OMITTED_TAGS}
      />
    </FilterContainer>
  );
}

const FilterContainer = styled('div')`
  display: inline-grid;
  grid-template-columns: minmax(0, max-content) minmax(20rem, 1fr);
  gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export default ReplaysFilters;

const OMITTED_TAGS = [
  'culprit',
  'device.arch',
  'device.battery_level',
  'device.charging',
  'device.locale',
  'device.online',
  'device.orientation',
  'device.simulator',
  'device.uuid',
  'error',
  'error.handled',
  'error.mechanism',
  'error.type',
  'error.unhandled',
  'error.value',
  'event.type',
  'geo',
  'geo.city',
  'geo.country_code',
  'geo.region',
  'has',
  'http',
  'http.method',
  'http.referer',
  'http.url',
  'id',
  'issue',
  'level',
  'location',
  'measurements',
  'measurements.app_start_cold',
  'measurements.app_start_warm',
  'measurements.cls',
  'measurements.fcp',
  'measurements.fid',
  'measurements.fp',
  'measurements.frames_frozen',
  'measurements.frames_frozen_rate',
  'measurements.frames_slow',
  'measurements.frames_slow_rate',
  'measurements.frames_total',
  'measurements.lcp',
  'measurements.stall_count',
  'measurements.stall_longest_time',
  'measurements.stall_percentage',
  'measurements.stall_total_time',
  'measurements.ttfb',
  'measurements.ttfb.requesttime',
  'message',
  'platform',
  'project',
  'release.build',
  'release.package',
  'release.stage',
  'release.version',
  'timestamp',
  'timestamp.to_day',
  'timestamp.to_hour',
  'spans',
  'spans.browser',
  'spans.db',
  'spans.http',
  'spans.resource',
  'spans.ui',
  'stack',
  'stack.abs_path',
  'stack.colno',
  'stack.filename',
  'stack.function',
  'stack.in_app',
  'stack.lineno',
  'stack.module',
  'stack.package',
  'stack.stack_level',
  'title',
  'trace',
  'trace.parent_span',
  'trace.span',
  'transaction',
  'transaction.duration',
  'transaction.op',
  'transaction.status',
];
