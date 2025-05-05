import {
  DatePageFilter,
  type DatePageFilterProps,
} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';

interface OverviewDatePageFilterProps {
  resetProjectParamsOnChange?: string[];
}

export function OverviewDatePageFilter({
  resetProjectParamsOnChange,
}: OverviewDatePageFilterProps) {
  const dateFilterProps: DatePageFilterProps = {};

  return (
    <PageFilterBar condensed>
      <ProjectPageFilter resetParamsOnChange={resetProjectParamsOnChange} />
      <EnvironmentPageFilter />
      <DatePageFilter {...dateFilterProps} />
    </PageFilterBar>
  );
}
