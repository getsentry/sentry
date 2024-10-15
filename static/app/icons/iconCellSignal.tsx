import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';

import {SvgIcon, type SVGIconProps} from 'sentry/icons/svgIcon';

interface Props extends SVGIconProps {
  bars?: 0 | 1 | 2 | 3;
}
const IconCellSignal = forwardRef<SVGSVGElement, Props>(({bars = 3, ...props}, ref) => {
  const theme = useTheme();
  const firstBarColor = bars > 0 ? theme.gray300 : theme.gray100;
  const secondBarColor = bars > 1 ? theme.gray300 : theme.gray100;
  const thirdBarColor = bars > 2 ? theme.gray300 : theme.gray100;

  return (
    <SvgIcon {...props} ref={ref}>
      <rect x="0" y="10" width="4" height="5" fill={firstBarColor} rx="1" />
      <rect x="6.2" y="5" width="4" height="10" fill={secondBarColor} rx="1" />
      <rect x="12.4" y="0" width="4" height="15" fill={thirdBarColor} rx="1" />
    </SvgIcon>
  );
});

IconCellSignal.displayName = 'IconCellSignal';

export {IconCellSignal};
