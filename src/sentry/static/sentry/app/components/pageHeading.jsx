import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

class PageHeading extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
  };

  render() {
    const {children, className} = this.props;
    return <Wrapper className={className}>{children}</Wrapper>;
  }
}

const Wrapper = styled('h1')`
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
`;

export default PageHeading;
