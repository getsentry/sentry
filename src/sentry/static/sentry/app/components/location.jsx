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
          <h5>{location.city}, {location.region}</h5>
          <p className="text-muted">{location.country}</p>
        </div>
      );
    return (
      <div>
        <h5>{location.city}</h5>
        <p className="text-muted">{location.country}</p>
      </div>
    );
  },
});
