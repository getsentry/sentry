import PropTypes from 'prop-types';
import React from 'react';
import {css} from '@emotion/core';

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

const modalCss = css`
  .modal-dialog {
    display: flex;
    margin: 0;
    left: 10px;
    right: 10px;
    top: 10px;
    bottom: 10px;
    width: auto;
  }
  .modal-content {
    display: flex;
    flex: 1;
  }
  .modal-body {
    display: flex;
    overflow: hidden;
    flex: 1;
  }
`;

export {modalCss};

export default DiffModal;
