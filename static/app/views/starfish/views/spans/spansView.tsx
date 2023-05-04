import styled from '@emotion/styled';
import {Location} from 'history';

import DatePageFilter from 'sentry/components/datePageFilter';
import {space} from 'sentry/styles/space';

import SpansTable from './spansTable';

type Props = {
  location: Location;
};

export default function SpansView(props: Props) {
  return (
    <div>
      <FilterOptionsContainer>
        <DatePageFilter alignDropdown="left" />
      </FilterOptionsContainer>
      <SpansTable location={props.location} />;
    </div>
  );
}

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;
