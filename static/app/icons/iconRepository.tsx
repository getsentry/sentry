import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function IconRepository(props: SVGIconProps) {
  const theme = useTheme();

  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M12.25 0C13.22 0 14 0.78 14 1.75V13.5C14 14.05 13.55 14.5 13 14.5H10.75C10.34 14.5 10 14.16 10 13.75C10 13.34 10.34 13 10.75 13H12.5V11.5H9V16L7 14L5 16V11.5H3.5V13.75C3.5 14.16 3.16 14.5 2.75 14.5C2.34 14.5 2 14.16 2 13.75V1.75C2 0.78 2.78 0 3.75 0H12.25ZM3.75 1.5C3.61 1.5 3.5 1.61 3.5 1.75V10H12.5V1.75C12.5 1.61 12.39 1.5 12.25 1.5H3.75Z" />
      ) : (
        <Fragment>
          <path d="M8.89 11.42a.75.75 0 0 1 .75.73l.05 2.5a.75.75 0 0 1-.41.68.75.75 0 0 1-.79-.07l-.8-.6-.8.6a.75.75 0 0 1-.78.07.75.75 0 0 1-.42-.66l-.05-2.5a.75.75 0 0 1 .21-.54.75.75 0 0 1 .54-.22H8.89Z" />
          <path d="M13.33 0a.75.75 0 0 1 .75.75v12.55a.75.75 0 0 1-.75.75h-1.88c-.41-.0-.75-.34-.75-.75.0-.41.34-.75.75-.75h1.13v-1.95H3.92c-.28.0-.5.23-.5.5v.94c.0.28.23.5.5.5.41 0 .75.34.75.75a.75.75 0 0 1-.75.75c-1.1-.0-2-.9-2-2V2C1.92.9 2.82.0 3.92 0h9.41ZM3.92 1.5c-.28.0-.5.23-.5.5V9.16a1.99 1.99 0 0 1 .5-.07h8.66V1.5H3.92Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
