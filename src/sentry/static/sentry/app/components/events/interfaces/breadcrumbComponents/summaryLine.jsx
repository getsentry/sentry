import React from 'react';

import Category from './category';
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
        {crumb.category && <Category value={crumb.category}/>}
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
