import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {imageStyle} from 'app/components/avatar/styles';
import theme from 'app/utils/theme';

type Props = {
  round?: boolean;
  suggested?: boolean;
  forwardedRef?: React.Ref<SVGSVGElement>;
};

type BackgroundAvatarProps = React.ComponentProps<'svg'> & Props;

/**
 * Creates an avatar placeholder that is used when showing multiple
 * suggested assignees
 */
const BackgroundAvatar = styled(
  ({round: _round, forwardedRef, ...props}: BackgroundAvatarProps) => (
    <svg ref={forwardedRef} viewBox="0 0 120 120" {...props}>
      <rect x="0" y="0" width="120" height="120" rx="15" ry="15" fill={theme.purple100} />
    </svg>
  )
)<Props>`
  ${imageStyle};
`;

BackgroundAvatar.propTypes = {
  round: PropTypes.bool,
};

BackgroundAvatar.defaultProps = {
  round: false,
  suggested: true,
};

export default React.forwardRef<SVGSVGElement, Props>((props, ref) => (
  <BackgroundAvatar forwardedRef={ref} {...props} />
));
