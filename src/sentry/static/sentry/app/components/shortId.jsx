import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import AutoSelectText from 'app/components/autoSelectText';

export default class ShortId extends React.Component {
  static propTypes = {
    shortId: PropTypes.string,
  };
  preventPropagation(e) {
    // this is a hack for the stream so the click handler doesn't
    // affect this element
    e.stopPropagation();
  }

  render() {
    const shortId = this.props.shortId;
    if (!shortId) {
      return null;
    }
    return (
      <StyledShortId onClick={this.preventPropagation} {...this.props}>
        <AutoSelectText>{shortId}</AutoSelectText>
      </StyledShortId>
    );
  }
}

const StyledShortId = styled.div`
  font-family: ${p => p.theme.text.familyMono};
`;
