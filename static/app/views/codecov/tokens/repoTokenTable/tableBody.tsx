import styled from '@emotion/styled';

import {Radio} from 'sentry/components/core/radio';
import {space} from 'sentry/styles/space';
import {
  type Column,
  type Row,
} from 'sentry/views/codecov/tokens/repoTokenTable/repoTokenTable';

interface TableBodyProps {
  column: Column;
  row: Row;
  selectedRepository: string | null;
}

export function renderTableBody({column, row, selectedRepository}: TableBodyProps) {
  const key = column.key;
  const value = row[key];
  const alignment = key === 'token' ? 'right' : 'left';

  if (key === 'name') {
    return (
      <RadioContainer>
        <Radio
          name={value}
          aria-label={value?.toString()}
          disabled={false}
          checked={selectedRepository === value}
          onChange={() => {}} // No-op since selection is handled at row level
        />
        <NameContainer>{value}</NameContainer>
      </RadioContainer>
    );
  }

  if (key === 'token') {
    return <Container alignment={alignment}>{value}</Container>;
  }

  if (key === 'createdAt') {
    return <DateContainer>{value}</DateContainer>;
  }

  return <Container alignment={alignment}>{value}</Container>;
}

export const RadioContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(4)};
`;

export const NameContainer = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  text-align: left;
`;

export const Container = styled('div')<{alignment: string}>`
  font-family: ${p => p.theme.text.familyMono};
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
`;

const DateContainer = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
  text-align: 'left';
`;
