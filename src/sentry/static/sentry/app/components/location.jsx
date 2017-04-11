import React from 'react';

export default React.createClass({
  propTypes: {
    location: React.PropTypes.object,
  },

  render() {
    let {location} = this.props;
    if (!location)
      return null;
    if (location.city && location.region)
      return (
        <div>
          <div>{location.city}, {location.region}</div>
          <small>{location.country}</small>
        </div>
      );
    return (
      <div>
        <div>{location.city}</div>
        <small>{location.country}</small>
      </div>
    );
  },
});
