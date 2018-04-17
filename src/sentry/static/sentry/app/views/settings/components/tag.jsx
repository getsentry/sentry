import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

const TagTextStyled = styled('span')`
  display: inline;
  padding: 0.4em 0.6em;
  font-size: 75%;
  font-weight: bold;
  line-height: 1;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  vertical-align: baseline;
  border-radius: 0.25em;
  margin-left: 0.5em;
  text-transform: lowercase;
  background-color: ${p =>
    p.priority ? p.theme.alert[p.priority].background : p.theme.gray1};
`;

const Tag = ({children, priority, ...props}) => (
  <TagTextStyled priority={priority}>{children}</TagTextStyled>
);

Tag.propTypes = {
  priority: PropTypes.string,
};

export default Tag;
