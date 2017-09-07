import React from 'react';
import Reflux from 'reflux';
import Modal from 'react-bootstrap/lib/Modal';
import classNames from 'classnames';

import IssueDiff from '../../components/issueDiff';
import ProjectModalStore from '../../stores/projectModalStore';
import ProjectActions from '../../actions/projectActions';
import '../../../less/components/modals/diffModal.less';

const DiffModal = React.createClass({
  mixins: [Reflux.connect(ProjectModalStore, 'diffModal')],

  render() {
    let {className} = this.props;
    let cx = classNames('diff-modal', className);

    return (
      <Modal
        className={cx}
        show={!!this.state.diffModal}
        animation={false}
        onHide={ProjectActions.closeDiffModal}>
        <div className="modal-body">
          {this.state.diffModal ? <IssueDiff {...this.state.diffModal} /> : null}
        </div>
      </Modal>
    );
  }
});

export default DiffModal;
