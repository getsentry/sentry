import styled from '@emotion/styled';

import space from 'sentry/styles/space';

type SearchBarFlyoutProps = {
  fullWidth?: boolean;
};

const SearchBarFlyout = styled('div')<SearchBarFlyoutProps>`
  /* Container has a border that we need to account for */
  position: absolute;
  top: 100%;
  left: -1px;
  ${p => (p.fullWidth ? 'right: -1px' : '')};
  z-index: ${p => p.theme.zIndex.dropdown};
  overflow: hidden;
  margin-top: ${space(1)};
  background: ${p => p.theme.background};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default SearchBarFlyout;
