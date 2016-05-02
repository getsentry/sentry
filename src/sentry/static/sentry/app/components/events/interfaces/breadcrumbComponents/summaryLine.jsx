import React from 'react';


const SummaryLine = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired
  },

  render() {
    // this is where we can later also show other interesting
    // information (maybe duration?)
    return (
      <div className="summary">
        {this.props.children}
      </div>
    );
  }
});

export default SummaryLine;
