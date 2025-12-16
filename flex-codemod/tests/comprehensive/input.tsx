import styled from '@emotion/styled';
import {space} from 'sentry/styles/space';

const FlexRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(2)};
`;

const FlexColumn = styled('span')`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SimpleWrapper = styled('div')`
  display: flex;
`;

export function MyComponent() {
  return (
    <FlexRow>
      <FlexColumn>
        <div>Item 1</div>
        <div>Item 2</div>
      </FlexColumn>
      <SimpleWrapper>Content</SimpleWrapper>
    </FlexRow>
  );
}
