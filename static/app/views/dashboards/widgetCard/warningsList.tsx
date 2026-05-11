import styled from '@emotion/styled';

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
  gap: ${p => p.theme.space.md};
  list-style-type: none;
  padding: 0;
  margin: 0;
`;
