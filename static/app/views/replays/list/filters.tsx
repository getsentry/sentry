import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';

export default function ReplaysFilters() {
  return (
    <PageFilterBar condensed>
      <ProjectPageFilter resetParamsOnChange={['cursor']} />
      <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
      <DatePageFilter resetParamsOnChange={['cursor']} />
    </PageFilterBar>
  );
}
