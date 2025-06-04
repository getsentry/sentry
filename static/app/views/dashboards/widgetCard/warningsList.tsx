import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

interface WarningsListProps {
  warnings: string[];
}

export function WarningsList({warnings}: WarningsListProps) {
  return (
    <UnstyledList>
      {warnings.map((warning, i) => (
        <li key={i}>{warning}</li>
      ))}
    </UnstyledList>
  );
}

const UnstyledList = styled('ul')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  list-style-type: none;
  padding: 0;
  margin: 0;
`;
