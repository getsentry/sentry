import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import PageFilterBar from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';

export default function ReplaysFilters() {
  return (
    <PageFilterBar condensed>
      <ProjectPageFilter resetParamsOnChange={['cursor']} />
      <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
      <DatePageFilter resetParamsOnChange={['cursor']} />
    </PageFilterBar>
  );
}
