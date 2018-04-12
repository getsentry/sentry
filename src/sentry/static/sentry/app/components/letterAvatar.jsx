import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

/**
 * Also see avatar.py. Anything changed in this file (how colors
 * are selected, the svg, etc) will also need to be changed there.
 */

const LetterAvatar = createReactClass({
  displayName: 'LetterAvatar',

  propTypes: {
    identifier: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
  },

  COLORS: [
    '#2C60BF', // blue
    '#2551A2', // blue_dark
    '#45BF84', // green
    '#3AA16F', // green_dark
    '#EB7738', // yellow_orange
    '#E02919', // red
    '#BD2215', // red_dark
    '#D94AA2', // pink
    '#5C4CC7', // purple
    '#40358B', // purple_dark
    '#3A90A6', // teal
    '#9585A3', // gray
  ],

  getColor() {
    let id = this.hashIdentifier(this.props.identifier);
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
    let names = (this.props.displayName.trim() || '?').split(' ');
    let initials = names[0][0] + (names.length > 1 ? names[names.length - 1][0] : '');
    return initials.toUpperCase();
  },

  render() {
    return (
      <svg viewBox="0 0 120 120" className={this.props.className}>
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
      </svg>
    );
  },
});

export default LetterAvatar;
