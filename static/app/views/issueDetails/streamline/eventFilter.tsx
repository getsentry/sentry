import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/inputGroup';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function EventFilter() {
  return (
    <FilterContainer>
      <InputGroup style={{flex: 1}}>
        <InputGroup.LeadingItems>
          <IconSearch size="xs" color="gray300" />
        </InputGroup.LeadingItems>
        <InputGroup.Input placeholder={t('Filter events...')} />
      </InputGroup>
      <DatePageFilter style={{flex: 1}} />
    </FilterContainer>
  );
}

const FilterContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(1)};
`;
