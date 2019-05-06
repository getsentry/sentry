import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

import AutoSelectText from 'app/components/autoSelectText';

export default class ShortId extends React.Component {
  static propTypes = {
    shortId: PropTypes.string,
    avatar: PropTypes.node,
  };
  preventPropagation(e) {
    // this is a hack for the stream so the click handler doesn't
    // affect this element
    e.stopPropagation();
  }

  render() {
    const {shortId, avatar} = this.props;

    if (!shortId) {
      return null;
    }

    return (
      <StyledShortId onClick={this.preventPropagation} {...this.props}>
        {avatar}
        <StyledAutoSelectText avatar={!!avatar}>{shortId}</StyledAutoSelectText>
      </StyledShortId>
    );
  }
}

const StyledShortId = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const StyledAutoSelectText = styled(AutoSelectText, {shouldForwardProp: isPropValid})`
  margin-left: ${p => p.avatar && '0.5em'};
  min-width: 0;
`;
