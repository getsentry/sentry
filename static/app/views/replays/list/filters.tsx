import {DatePageFilter} from 'sentry/components/pageFilters/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environmentPageFilter';
import PageFilterBar from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/projectPageFilter';

export default function ReplaysFilters() {
  return (
    <PageFilterBar condensed>
      <ProjectPageFilter resetParamsOnChange={['cursor']} />
      <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
      <DatePageFilter resetParamsOnChange={['cursor']} />
    </PageFilterBar>
  );
}
