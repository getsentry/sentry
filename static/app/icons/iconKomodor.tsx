import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconKomodor = React.forwardRef(function IconKomodor(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.447266 62.797L61.0103 0.219727H618.905L679.464 62.5239V420.232L618.905 482.537H61.0059L0.447266 420.232V62.797ZM100.545 68.3295L76.88 92.1459V391.027L100.545 414.843H580.1L602.893 390.987V92.1855L580.1 68.3295H100.545Z"
        fill="#1347FF"
      />
      <path
        d="M424.666 304.683C456.136 304.683 481.646 267.834 481.646 222.379C481.646 176.924 456.136 140.075 424.666 140.075C393.197 140.075 367.687 176.924 367.687 222.379C367.687 267.834 393.197 304.683 424.666 304.683Z"
        fill="#1347FF"
      />
      <path
        d="M255.231 304.683C286.7 304.683 312.211 267.834 312.211 222.379C312.211 176.924 286.7 140.075 255.231 140.075C223.762 140.075 198.251 176.924 198.251 222.379C198.251 267.834 223.762 304.683 255.231 304.683Z"
        fill="#1347FF"
      />
    </SvgIcon>
  );
});

IconKomodor.displayName = 'IconKomodor';

export {IconKomodor};
