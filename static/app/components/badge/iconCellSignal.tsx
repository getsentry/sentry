import {useTheme} from '@emotion/react';

import {SvgIcon, type SVGIconProps} from 'sentry/icons/svgIcon';

interface Props extends SVGIconProps {
  bars?: 0 | 1 | 2 | 3;
}
function IconCellSignal({ref, bars = 3, ...props}: Props) {
  const theme = useTheme();
  const firstBarColor = bars > 0 ? theme.tokens.content.secondary : theme.colors.gray200;
  const secondBarColor = bars > 1 ? theme.tokens.content.secondary : theme.colors.gray200;
  const thirdBarColor = bars > 2 ? theme.tokens.content.secondary : theme.colors.gray200;

  return (
    <SvgIcon {...props} ref={ref}>
      <rect x="0" y="10" width="4" height="5" fill={firstBarColor} rx="1" />
      <rect x="6.2" y="5" width="4" height="10" fill={secondBarColor} rx="1" />
      <rect x="12.4" y="0" width="4" height="15" fill={thirdBarColor} rx="1" />
    </SvgIcon>
  );
}

IconCellSignal.displayName = 'IconCellSignal';

export {IconCellSignal};
