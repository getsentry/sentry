import React from 'react';

/**
 * Also see avatar.py. Anything changed in this file (how colors
 * are selected, the svg, etc) will also need to be changed there.
 */

const LetterAvatar = React.createClass({
  propTypes: {
    identifier: React.PropTypes.string.isRequired,
    displayName: React.PropTypes.string.isRequired
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
    '#847a8c'  // gray
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
        <rect x="0" y="0" width="120" height="120" rx="15" ry="15" fill={this.getColor()}/>
        <text x="50%" y="50%" fontSize="65" style={{'dominantBaseline': 'central'}}
              textAnchor="middle" fill="#FFFFFF">{this.getInitials()}</text>
      </svg>
    );
  }
});

export default LetterAvatar;
