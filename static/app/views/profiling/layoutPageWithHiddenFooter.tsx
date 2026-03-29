import styled from '@emotion/styled';


// The footer component is a sibling of this div.
// Remove it so the flamegraph can take up the
// entire screen.
export const LayoutPageWithHiddenFooter = styled('div')`
  ~ footer {
    display: none;
  }
`;
