import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import space from 'app/styles/space';

class PageHeading extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    withMargins: PropTypes.bool,
  };

  render() {
    const {children, className, withMargins} = this.props;
    return (
      <Wrapper className={className} withMargins={withMargins}>
        {children}
      </Wrapper>
    );
  }
}

const Wrapper = styled('h1')`
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
  margin-bottom: ${p => p.withMargins && space(3)};
  margin-top: ${p => p.withMargins && space(1)};
`;

export default PageHeading;
