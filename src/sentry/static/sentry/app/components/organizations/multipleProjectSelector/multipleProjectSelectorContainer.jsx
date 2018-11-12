import React from 'react';

import FetchTeams from './fetchTeams';
import MultipleProjectSelector from './multipleProjectSelector';

class MultipleProjectSelectorContainer extends React.Component {
  render() {
    return (
      <FetchTeams {...this.props}>
        {props => <MultipleProjectSelector {...this.props} {...props} />}
      </FetchTeams>
    );
  }
}
export default MultipleProjectSelectorContainer;
