import styled from '@emotion/styled';

// The footer component is a sibling of this div.
// Remove it so the flamegraph can take up the
// entire screen.

// @TODO(JonasBadalic): Remove this component once the page-frame feature is GA'd
// When that feature is enabled, the footer is no longer rendered at the bottom of the page.
export const LayoutPageWithHiddenFooter = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;

  ~ footer {
    display: none;
  }
`;
