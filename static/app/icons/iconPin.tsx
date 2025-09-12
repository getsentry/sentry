import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {useIconDefaults} from 'sentry/icons/useIconDefaults';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  isSolid?: boolean;
}

export function IconPin({isSolid = false, ...props}: Props) {
  const theme = useTheme();
  const {color: providedColor = 'currentColor'} = useIconDefaults(props);

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const color = theme[providedColor] ?? providedColor;

  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <line x1="8.66" y1="2.04" x2="13.96" y2="7.34" />
          <path
            fill={isSolid ? color : 'none'}
            d="m8.87,12.85L3.15,7.13c-.29-.29-.13-.77.26-.85l2.95-.54,3.01-3.01,3.89,3.89-3.01,3.01-.54,2.95c-.07.4-.56.55-.85.26Z"
          />
          <line x1="6.01" y1="9.99" x2="2.75" y2="13.25" />
        </Fragment>
      ) : isSolid ? (
        <Fragment>
          <path d="M9.48,14.24A.71.71,0,0,1,9,14L5.49,10.55,2.36,7.45,2,7.13a.74.74,0,0,1,0-1l.29-.33c1-1.09,2.49-1.5,4.55-1.22L9.64.79a.76.76,0,0,1,.55-.31.78.78,0,0,1,.58.22l4.52,4.54a.7.7,0,0,1,.22.58.72.72,0,0,1-.3.55L11.46,9.15c.3,2.14-.08,3.65-1.15,4.61l-.34.29A.72.72,0,0,1,9.48,14.24Z" />
          <path d="M.9,15.89a.79.79,0,0,1-.53-.22.75.75,0,0,1,0-1.06l4.89-4.9a.77.77,0,0,1,1.07,0,.75.75,0,0,1,0,1.06l-4.9,4.9A.79.79,0,0,1,.9,15.89Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M9.48,14.24A.71.71,0,0,1,9,14L5.49,10.55,2.36,7.45,2,7.13a.74.74,0,0,1,0-1l.29-.33c1-1.09,2.49-1.5,4.55-1.22L9.64.79a.76.76,0,0,1,.55-.31.78.78,0,0,1,.58.22l4.52,4.54a.7.7,0,0,1,.22.58.72.72,0,0,1-.3.55L11.46,9.15c.3,2.14-.08,3.65-1.15,4.61l-.34.29A.72.72,0,0,1,9.48,14.24ZM3.62,6.59C4,7,5,8,6.54,9.49l3,3c.59-.68.72-1.81.42-3.5a.74.74,0,0,1,.29-.73l3.42-2.53-3.3-3.31L7.8,5.81a.78.78,0,0,1-.73.3C5.47,5.82,4.31,6,3.62,6.59Z" />
          <path d="M.9,15.89a.79.79,0,0,1-.53-.22.75.75,0,0,1,0-1.06l4.89-4.9a.77.77,0,0,1,1.07,0,.75.75,0,0,1,0,1.06l-4.9,4.9A.79.79,0,0,1,.9,15.89Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
