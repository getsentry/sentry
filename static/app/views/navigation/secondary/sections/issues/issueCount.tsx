import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Text} from '@sentry/scraps/text';

const MAX_COUNT = 99;

export function IssueCount({count}: {count: number}) {
  return (
    <StyledTag variant="muted">
      <Text variant="muted" size="xs" align="center" tabular>
        {count > MAX_COUNT ? `${MAX_COUNT}+` : count}
      </Text>
    </StyledTag>
  );
}

const StyledTag = styled(Tag)`
  border: 1px solid ${p => p.theme.tokens.border.neutral.muted};
  background-color: ${p => p.theme.tokens.background.primary};
  padding: 0 ${p => p.theme.space.xs};
  justify-content: end;

  opacity: 0;
  transform: scale(0.95);

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  animation: fadeIn 0.1s ease-in-out forwards;
`;
