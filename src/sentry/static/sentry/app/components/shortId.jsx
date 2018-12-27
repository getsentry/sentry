import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import ProjectState from 'app/mixins/projectState';

import AutoSelectText from 'app/components/autoSelectText';

const ShortId = createReactClass({
  displayName: 'ShortId',

  propTypes: {
    shortId: PropTypes.string,
  },

  mixins: [ProjectState],

  preventPropagation(e) {
    // this is a hack for the stream so the click handler doesn't
    // affect this element
    e.stopPropagation();
  },

  render() {
    let shortId = this.props.shortId;
    if (!shortId) {
      return null;
    }
    return (
      <StyledShortId onClick={this.preventPropagation} {...this.props}>
        <AutoSelectText>{shortId}</AutoSelectText>
      </StyledShortId>
    );
  },
});

const StyledShortId = styled.div`
  font-family: ${p => p.theme.text.familyMono};
`;

export default ShortId;
