import React from 'react';

import Duration from '../../../duration';


const SummaryLine = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired
  },

  render() {
    let {crumb} = this.props;
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
