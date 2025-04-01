import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  /**
   * @deprecated Circled variant will be removed.
   */
  isCircled?: boolean;
}

function IconSubtract({isCircled = false, ...props}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon
      {...props}
      data-test-id="icon-subtract"
      kind={theme.isChonk ? 'stroke' : 'path'}
    >
      {theme.isChonk ? (
        <line x1="2.75" y1="8" x2="13.25" y2="8" />
      ) : isCircled ? (
        <Fragment>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <path d="M11.28,8.75H4.72a.75.75,0,1,1,0-1.5h6.56a.75.75,0,1,1,0,1.5Z" />
        </Fragment>
      ) : (
        <path d="M14,8.75H2a.75.75,0,0,1,0-1.5H14a.75.75,0,0,1,0,1.5Z" />
      )}
    </SvgIcon>
  );
}

IconSubtract.displayName = 'IconSubtract';

export {IconSubtract};
