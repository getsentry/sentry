import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon, useResolvedIconColor} from 'sentry/icons/svgIcon';

export function IconRepository(props: SVGIconProps) {
  const theme = useTheme();
  const color = useResolvedIconColor(props.color);

  return (
    <SvgIcon
      {...props}
      kind={theme.isChonk ? 'stroke' : 'path'}
      data-test-id="icon-repository"
    >
      {theme.isChonk ? (
        <Fragment>
          <path d="M4.77 12.75c-.55 0-1-.45-1-1v-8c0-.55.45-1 1-1h7.5v10h-1.5" />
          <path
            fill={color}
            d="M3.77 11c0-.55.45-1 1-1h7.5m-5.5 2v2l1-.75 1 .75v-2h-2Z"
          />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8.8901 11.418a.7502.7502 0 0 1 .75.7343l.0508 2.4961a.7503.7503 0 0 1-.4072.6827.7519.7519 0 0 1-.793-.0674l-.8047-.6045-.8046.6045a.7505.7505 0 0 1-.7784.0742.7517.7517 0 0 1-.4219-.6592l-.0507-2.4951a.7525.7525 0 0 1 .2138-.541.7513.7513 0 0 1 .5362-.2246H8.89Z" />
          <path d="M13.3335 0a.75.75 0 0 1 .75.75v12.5488a.7502.7502 0 0 1-.75.75h-1.8828c-.4138-.0004-.7499-.3361-.75-.75.0002-.4137.3363-.7496.75-.75h1.1328v-1.9511H3.9214c-.2757.0002-.5047.2292-.5049.5048v.9414c.0001.2758.2291.5047.5049.5049.414 0 .7497.336.75.75a.7502.7502 0 0 1-.75.75c-1.1042-.0002-2.0048-.9007-2.0049-2.0049V2.0049C1.9165.9006 2.8172.0002 3.9214 0h9.4121ZM3.9214 1.5c-.2758.0002-.5049.229-.5049.5049V9.165a1.9934 1.9934 0 0 1 .5049-.0673h8.6621V1.5H3.9214Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
