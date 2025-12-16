import styled from '@emotion/styled';
import {space} from 'sentry/styles/space';

const FlexWithSpace = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const FlexWithTheme = styled('div')`
  display: flex;
  gap: ${p => p.theme.space[1]};
`;

function Component() {
  return (
    <>
      <FlexWithSpace>Content</FlexWithSpace>
      <FlexWithTheme>Content</FlexWithTheme>
    </>
  );
}
