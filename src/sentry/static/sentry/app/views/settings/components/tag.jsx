import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

const getMarginLeft = p => {
  if (!p.inline) return '';
  return `margin-left: ${p.size == 'small' ? '0.25em' : '0.5em'};`;
};

const TagTextStyled = styled('span')`
  display: inline;
  padding: ${p => (p.size == 'small' ? '0.1em 0.4em' : '0.4em 0.6em')};
  ${p =>
    p.border
      ? `border: 1px solid ${p.theme.alert[p.priority].border};`
      : ''} font-size: 75%;
  font-weight: bold;
  line-height: 1;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  vertical-align: baseline;
  border-radius: 0.25em;
  text-transform: lowercase;
  background-color: ${p =>
    p.priority ? p.theme.alert[p.priority].background : p.theme.gray1};
  ${p => getMarginLeft(p)};
`;

const Tag = ({children, priority, size, border, ...props}) => (
  <TagTextStyled priority={priority} size={size} border={border} {...props}>
    {children}
  </TagTextStyled>
);

Tag.propTypes = {
  priority: PropTypes.string,
  size: PropTypes.string,
  border: PropTypes.bool,
};

export default Tag;
