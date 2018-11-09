import React from 'react';

import FetchTeams from './fetchTeams';
import MultipleProjectSelector from './multipleProjectSelector';

class MultipleProjectSelectorContainer extends React.Component {
  render() {
    return (
      <FetchTeams {...this.props}>
        {({teams}) => <MultipleProjectSelector {...this.props} teams={teams} />}
      </FetchTeams>
    );
  }
}
export default MultipleProjectSelectorContainer;
