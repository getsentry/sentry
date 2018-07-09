import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';

import {
  Panel,
  PanelHeader,
  PanelBody,
  PanelItem,
  PanelItemGroup,
} from 'app/components/panels';

class HelpBox extends React.Component {
  static propTypes = {
    skip: PropTypes.func,
    hasEvent: PropTypes.bool.isRequired,
  };

  render() {
    return (
      <div >
        <Panel>
          <PanelHeader>Need More?</PanelHeader>
          <PanelBody>
                <ul> Check out <a> Resource 1 </a> </ul>
                <ul> Check out <a> Resource 2 </a> </ul>
                <ul> Check out <a> Resource 3 </a> </ul>
          </PanelBody>
        </Panel>
      </div> 



    );
  }
}

export default HelpBox;
