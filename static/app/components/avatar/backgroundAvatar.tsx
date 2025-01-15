import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {imageStyle} from 'sentry/components/avatar/styles';
import theme from 'sentry/utils/theme';

interface Props extends React.ComponentProps<'svg'> {
  forwardedRef?: React.Ref<SVGSVGElement>;
  round?: boolean;
  suggested?: boolean;
}

/**
 * Creates an avatar placeholder that is used when showing multiple
 * suggested assignees
 */
const BackgroundAvatar = styled(({round: _round, forwardedRef, ...props}: Props) => (
  <svg ref={forwardedRef} viewBox="0 0 120 120" {...props}>
    <rect x="0" y="0" width="120" height="120" rx="15" ry="15" fill={theme.purple100} />
  </svg>
))<Props>`
  ${imageStyle};
`;

export default forwardRef<SVGSVGElement, Props>((props, ref) => (
  <BackgroundAvatar suggested round={false} forwardedRef={ref} {...props} />
));
