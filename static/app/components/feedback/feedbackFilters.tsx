import type {CSSProperties} from 'react';

import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import PageFilterBar from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackFilters({className, style}: Props) {
  return (
    <PageFilterBar className={className} style={style}>
      <ProjectPageFilter resetParamsOnChange={['cursor']} />
      <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
      <DatePageFilter resetParamsOnChange={['cursor']} />
    </PageFilterBar>
  );
}
