import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {imageStyle} from 'app/components/avatar/styles';

/**
 * Also see avatar.py. Anything changed in this file (how colors
 * are selected, the svg, etc) will also need to be changed there.
 */

const LetterAvatar = createReactClass({
  displayName: 'LetterAvatar',

  propTypes: {
    identifier: PropTypes.string,
    displayName: PropTypes.string,
    round: PropTypes.bool,
  },

  COLORS: [
    '#4674ca', // blue
    '#315cac', // blue_dark
    '#57be8c', // green
    '#3fa372', // green_dark
    '#f9a66d', // yellow_orange
    '#ec5e44', // red
    '#e63717', // red_dark
    '#f868bc', // pink
    '#6c5fc7', // purple
    '#4e3fb4', // purple_dark
    '#57b1be', // teal
    '#847a8c', // gray
  ],

  getColor() {
    const id = this.hashIdentifier(this.props.identifier);
    return this.COLORS[id % this.COLORS.length];
  },

  hashIdentifier(identifier) {
    identifier += '';
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash += identifier.charCodeAt(i);
    }
    return hash;
  },

  getInitials() {
    const names = (this.props.displayName.trim() || '?').split(' ');
    // Use Array.from as slicing and substring() work on ucs2 segments which
    // results in only getting half of any 4+ byte character.
    let initials = Array.from(names[0])[0];
    if (names.length > 1) {
      initials += Array.from(names[names.length - 1])[0];
    }
    return initials.toUpperCase();
  },

  render() {
    return (
      <Svg
        viewBox="0 0 120 120"
        round={this.props.round}
        className={this.props.className}
      >
        <rect
          x="0"
          y="0"
          width="120"
          height="120"
          rx="15"
          ry="15"
          fill={this.getColor()}
        />
        <text
          x="50%"
          y="50%"
          fontSize="65"
          style={{dominantBaseline: 'central'}}
          textAnchor="middle"
          fill="#FFFFFF"
        >
          {this.getInitials()}
        </text>
      </Svg>
    );
  },
});

export default LetterAvatar;

const Svg = styled('svg')`
  ${imageStyle};
`;
