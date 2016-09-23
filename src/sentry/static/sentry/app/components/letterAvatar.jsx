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
    '#25A6F7', // blue
    '#1D87CE', // blue_dark
    '#6FBA57', // green
    '#4F923C', // green_dark
    '#F8A509', // yellow_orange
    '#E35141', // red
    '#B64236', // red_dark
    '#E56AA6', // pink
    '#836CC2', // purple
    '#6958A2', // purple_dark
    '#44ADA0', // teal
    '#6F7E94'  // gray
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
