import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';

const getMarginLeft = p => {
  if (!p.inline) {
    return '';
  }
  return `margin-left: ${p.size === 'small' ? '0.25em' : '0.5em'};`;
};

const getBorder = p =>
  p.border
    ? `border: 1px solid ${
        p.priority ? p.theme.alert[p.priority].border : p.theme.gray1
      };`
    : '';

const TagTextStyled = styled(({priority, size, border, inline, ...props}) => (
  <Box {...props} />
))`
  display: inline-flex;
  padding: ${p => (p.size === 'small' ? '0.1em 0.4em 0.2em' : '0.35em 0.8em 0.4em')};
  font-size: 75%;
  line-height: 1;
  color: ${p => (p.priority ? '#fff' : p.gray5)};
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  border-radius: ${p => (p.size === 'small' ? '0.25em' : '2em')};
  text-transform: lowercase;
  font-weight: ${p => (p.size === 'small' ? 'bold' : 'normal')};
  background: ${p =>
    p.priority ? p.theme.alert[p.priority].background : p.theme.offWhite2};
  ${p => getBorder(p)};
  ${p => getMarginLeft(p)};
`;

const Tag = ({children, icon, priority, size, border, ...props}) => (
  <TagTextStyled priority={priority} size={size} border={border} {...props}>
    {icon && <StyledInlineSvg src={icon} size="12px" />}
    {children}
  </TagTextStyled>
);

Tag.propTypes = {
  priority: PropTypes.string,
  size: PropTypes.string,
  border: PropTypes.bool,
  icon: PropTypes.string,
  inline: PropTypes.bool,
};

const StyledInlineSvg = styled(InlineSvg)`
  margin-right: 4px;
`;

export default Tag;
