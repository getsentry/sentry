import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon, useResolvedIconColor} from 'sentry/icons/svgIcon';

export function IconBranch(props: SVGIconProps) {
  const theme = useTheme();
  const color = useResolvedIconColor(props.color);
  return (
    <SvgIcon
      {...props}
      kind={theme.isChonk ? 'stroke' : 'path'}
      data-test-id="icon-branch"
    >
      {theme.isChonk ? (
        <Fragment>
          <path
            fill={color}
            d="M5 13.25c.5523 0 1-.4477 1-1s-.4477-1-1-1-1 .4477-1 1 .4477 1 1 1Zm0-8.5c.5523 0 1-.4477 1-1s-.4477-1-1-1-1 .4477-1 1 .4477 1 1 1Zm6.5 0c.5523 0 1-.4477 1-1s-.4477-1-1-1-1 .4477-1 1 .4477 1 1 1Z"
          />
          <path d="M5 3.75v8.5m0 .25V11c0-1.66 1.59-3 3.25-3s3.25-1.34 3.25-3V3.75" />
        </Fragment>
      ) : (
        <path d="M12.4863 1.1953c.9662.0003 1.7498.7839 1.75 1.75 0 .698-.4098 1.2982-1.0009 1.5791v.1387c-.0003 2.4933-2.3343 4.372-4.6739 4.372-1.6693 0-3.1748 1.3576-3.1748 2.8731v.2314c.591.281 1 .8823 1 1.5801-.0002.9664-.7836 1.75-1.75 1.75-.9663 0-1.7498-.7837-1.75-1.75 0-.6978.4091-1.2991 1-1.5801V4.5244c-.5907-.281-1-.8814-1-1.579.0003-.9664.7837-1.75 1.75-1.75.9664 0 1.7498.7836 1.75 1.75 0 .6976-.4093 1.298-1 1.579V8.752c.8717-.7606 2.0225-1.2168 3.1748-1.2168 1.6691-.0002 3.1736-1.3568 3.1739-2.8721v-.1397c-.5901-.2813-.9991-.8808-.9991-1.578.0003-.9664.7837-1.75 1.75-1.75Z" />
      )}
    </SvgIcon>
  );
}
