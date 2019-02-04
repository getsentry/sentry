import PropTypes from 'prop-types';
import React from 'react';

import IssueDiff from 'app/components/issueDiff';

class DiffModal extends React.Component {
  static propTypes = {
    Body: PropTypes.func,
  };

  render() {
    const {className, Body} = this.props;

    return (
      <Body>
        <IssueDiff className={className} {...this.props} />
      </Body>
    );
  }
}

export default DiffModal;
