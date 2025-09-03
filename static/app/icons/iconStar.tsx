import {useTheme} from '@emotion/react';

import {useIconDefaults} from 'sentry/icons/useIconDefaults';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  isSolid?: boolean;
}

export function IconStar({isSolid = false, ...props}: Props) {
  const theme = useTheme();
  const {color: providedColor = 'currentColor'} = useIconDefaults(props);

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  let color = theme[providedColor] ?? providedColor;

  // @TODO(jonasbadalic): icons should only use chonk colors.
  if (isChonkTheme(theme) && providedColor.startsWith('yellow')) {
    color = theme.colors.chonk.yellow400;
  }

  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <path
          fill={isSolid ? color : 'none'}
          stroke={color}
          d="m8.27,2.25l1.56,3.16c.04.07.11.12.19.14l3.49.51c.21.03.29.28.14.43l-2.52,2.46c-.06.06-.09.14-.07.22l.6,3.47c.04.2-.18.36-.36.26l-3.12-1.64c-.07-.04-.16-.04-.23,0l-3.12,1.64c-.18.1-.4-.06-.36-.26l.6-3.47c.01-.08-.01-.16-.07-.22l-2.52-2.46c-.15-.14-.07-.4.14-.43l3.49-.51c.08-.01.15-.06.19-.14l1.56-3.16c.09-.19.36-.19.45,0Z"
        />
      ) : isSolid ? (
        <path d="M12.47,15.63a.73.73,0,0,1-.35-.09L8,13.38,3.88,15.54a.75.75,0,0,1-.79,0,.76.76,0,0,1-.3-.74l.79-4.59L.24,6.91A.75.75,0,0,1,.66,5.63L5.27,5,7.33.79a.78.78,0,0,1,1.34,0L10.73,5l4.61.67a.75.75,0,0,1,.42,1.28l-3.34,3.25.79,4.59a.76.76,0,0,1-.3.74A.79.79,0,0,1,12.47,15.63Z" />
      ) : (
        <path d="M12.47,15.63a.73.73,0,0,1-.35-.09L8,13.38,3.88,15.54a.75.75,0,0,1-.79,0,.76.76,0,0,1-.3-.74l.79-4.59L.24,6.91A.75.75,0,0,1,.66,5.63L5.27,5,7.33.79a.78.78,0,0,1,1.34,0L10.73,5l4.61.67a.75.75,0,0,1,.42,1.28l-3.34,3.25.79,4.59a.76.76,0,0,1-.3.74A.79.79,0,0,1,12.47,15.63ZM8,11.78a.85.85,0,0,1,.35.08l3.12,1.65L10.88,10a.78.78,0,0,1,.21-.67L13.62,6.9l-3.49-.51A.74.74,0,0,1,9.56,6L8,2.82,6.44,6a.74.74,0,0,1-.57.41L2.38,6.9,4.91,9.36a.78.78,0,0,1,.21.67l-.59,3.48,3.12-1.65A.85.85,0,0,1,8,11.78Z" />
      )}
    </SvgIcon>
  );
}
