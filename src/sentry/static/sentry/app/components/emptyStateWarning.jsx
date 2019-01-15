import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import HeroIcon from 'app/components/heroIcon';
import InlineSvg from 'app/components/inlineSvg';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

class EmptyStateWarning extends React.Component {
  static propTypes = {
    small: PropTypes.bool,
  };

  static defaultProps = {
    small: false,
  };

  render() {
    if (this.props.small) {
      return (
        <EmptyMessage>
          <SmallMessage>
            <InlineSvg src="icon-circle-exclamation" width="34px" />
            {this.props.children}
          </SmallMessage>
        </EmptyMessage>
      );
    }

    return (
      <EmptyStreamWrapper data-test-id="empty-state">
        <HeroIcon src="icon-circle-exclamation" size="54" />
        {this.props.children}
      </EmptyStreamWrapper>
    );
  }
}

const EmptyStreamWrapper = styled.div`
  text-align: center;
  font-size: 22px;
  padding: 48px 0;

  p {
    line-height: 1.2;
    margin: 0 auto 20px;
    &:last-child {
      margin-bottom: 0;
    }
  }

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${HeroIcon} {
    margin-bottom: 20px;
  }
`;

const SmallMessage = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1em;
`;

export default EmptyStateWarning;
