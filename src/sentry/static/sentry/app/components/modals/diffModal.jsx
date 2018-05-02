import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import IssueDiff from 'app/components/issueDiff';
import 'app/../less/components/modals/diffModal.less';

class DiffModal extends React.Component {
  static propTypes = {
    Body: PropTypes.func,
  };

  render() {
    let {className, Body} = this.props;
    let cx = classNames('diff-modal', className);

    return (
      <Body>
        <IssueDiff className={cx} {...this.props} />
      </Body>
    );
  }
}

export default DiffModal;
