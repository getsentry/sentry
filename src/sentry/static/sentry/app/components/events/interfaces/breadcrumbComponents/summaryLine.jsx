import React from 'react';

import Duration from '../../../duration';


const SummaryLine = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired
  },

  render() {
    let {crumb} = this.props;
    return (
      <div className="summary">
        {this.props.children}
        {crumb.duration &&
          <span className="crumb-timing">
            [<Duration seconds={crumb.duration}/>]
          </span>
        }
      </div>
    );
  }
});

export default SummaryLine;
