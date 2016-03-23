import React from 'react';

const NavigationCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    return (
      <p>
        <strong>Navigation</strong>
        {data.from &&
          <span> from <code>{data.from}</code></span>}
        to <code>{data.to}</code>
      </p>
    );
  }
});

export default NavigationCrumbComponent;
