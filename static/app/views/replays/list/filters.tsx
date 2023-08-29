import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {space} from 'sentry/styles/space';

export default function ReplaysFilters({children}: {children?: ReactNode}) {
  return (
    <FiltersContainer>
      <PageFilterBar condensed>
        <ProjectPageFilter resetParamsOnChange={['cursor']} />
        <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
        <DatePageFilter alignDropdown="left" resetParamsOnChange={['cursor']} />
      </PageFilterBar>
      {children}
    </FiltersContainer>
  );
}

const FiltersContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
`;
