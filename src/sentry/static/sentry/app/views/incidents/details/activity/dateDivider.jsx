/**
 * Activity component on Incident Details view
 * Allows user to leave a comment on an incident as well as
 * fetch and render existing activity items.
 */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import space from 'app/styles/space';

const Title = styled('span')`
  background-color: ${p => p.backgroundColor || p.theme.whiteDark};
  padding: 0 ${space(2)};
`;

const TitleWrapper = styled('span')`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;

  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray3};
`;

const DateDivider = styled(
  class DateDivider extends React.Component {
    static propTypes = {
      backgroundColor: PropTypes.string,
    };

    render() {
      const {children, backgroundColor, ...props} = this.props;
      return (
        <div {...props}>
          <hr />
          <TitleWrapper>
            <Title backgroundColor={backgroundColor}>{children}</Title>
          </TitleWrapper>
        </div>
      );
    }
  }
)`
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default DateDivider;
