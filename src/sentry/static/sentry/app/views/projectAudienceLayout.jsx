import React from 'react';

export default React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  componentWillMount() {
    this.props.setProjectNavSection('audience');
  },

  render() {
    return (
      <div>
        {this.props.children}
      </div>
    );
  },
});
