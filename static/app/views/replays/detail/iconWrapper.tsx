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
  background: ${p => (p.hasOccurred ? p.theme[p.color] ?? p.color : p.theme.purple200)};
  position: relative;

  /* Make sure the icon is above the line through the back */
  z-index: ${p => p.theme.zIndex.initial};
`;

export default IconWrapper;
