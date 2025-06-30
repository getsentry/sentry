import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {
  type Column,
  type Row,
} from 'sentry/views/codecov/tokens/repoTokenTable/repoTokenTable';

interface TableBodyProps {
  column: Column;
  row: Row;
}

export function renderTableBody({column, row}: TableBodyProps) {
  const key = column.key;
  const alignment = ['regenerateToken', 'token'].includes(key) ? 'right' : 'left';

  if (key === 'regenerateToken') {
    return (
      <AlignmentContainer alignment={alignment}>
        <StyledButton
          size="sm"
          priority="default"
          onClick={() => {}}
          aria-label="regenerate token"
        >
          Regenerate token
        </StyledButton>
      </AlignmentContainer>
    );
  }

  const value = row[key];

  if (key === 'name') {
    return <AlignmentContainer alignment={alignment}>{value}</AlignmentContainer>;
  }

  if (key === 'token') {
    return <AlignmentContainer alignment={alignment}>{value}</AlignmentContainer>;
  }

  if (key === 'createdAt') {
    return <DateContainer>{value}</DateContainer>;
  }

  return <AlignmentContainer alignment={alignment}>{value}</AlignmentContainer>;
}

const StyledButton = styled(Button)`
  max-width: 175px;
`;

export const AlignmentContainer = styled('div')<{alignment: string}>`
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
`;

const DateContainer = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
  text-align: 'left';
`;
