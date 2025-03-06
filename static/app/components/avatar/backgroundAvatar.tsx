import {forwardRef} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {imageStyle} from 'sentry/components/avatar/styles';

interface Props extends React.ComponentProps<'svg'> {
  theme: Theme;
  forwardedRef?: React.Ref<SVGSVGElement>;
  round?: boolean;
  suggested?: boolean;
}

/**
 * Creates an avatar placeholder that is used when showing multiple
 * suggested assignees
 */
const BackgroundAvatar = styled(
  ({round: _round, forwardedRef, theme, ...props}: Props) => (
    <svg ref={forwardedRef} viewBox="0 0 120 120" {...props}>
      <rect x="0" y="0" width="120" height="120" rx="15" ry="15" fill={theme.purple100} />
    </svg>
  )
)<Props>`
  ${imageStyle};
`;

export default forwardRef<SVGSVGElement, Omit<Props, 'theme'>>((props, ref) => {
  const theme = useTheme();
  return (
    <BackgroundAvatar
      suggested
      round={false}
      forwardedRef={ref}
      theme={theme}
      {...props}
    />
  );
});
