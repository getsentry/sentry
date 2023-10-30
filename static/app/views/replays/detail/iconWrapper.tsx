import styled from '@emotion/styled';

import {SVGIconProps} from 'sentry/icons/svgIcon';

/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */
const IconWrapper = styled('div')<
  {hasOccurred: boolean} & Required<Pick<SVGIconProps, 'color'>>
>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  position: relative;
  opacity: ${p => (p.hasOccurred ? 1 : 0.8)};

  /* Make sure the icon is above the line through the back */
  z-index: ${p => p.theme.zIndex.initial};
`;

export default IconWrapper;
