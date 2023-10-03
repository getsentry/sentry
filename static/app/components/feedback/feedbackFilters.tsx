import {CSSProperties} from 'react';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackFilters({className, style}: Props) {
  return (
    <PageFilterBar className={className} style={style}>
      <ProjectPageFilter resetParamsOnChange={['cursor']} />
      <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
      <DatePageFilter alignDropdown="left" resetParamsOnChange={['cursor']} />
    </PageFilterBar>
  );
}
