import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import {t} from 'app/locale';

const Snooze = {
  // all values in minutes
  '30MINUTES': 30,
  '2HOURS': 60 * 2,
  '24HOURS': 60 * 24,
};

class SnoozeAction extends React.Component {
  static propTypes = {
    disabled: PropTypes.bool,
    onSnooze: PropTypes.func.isRequired,
    tooltip: PropTypes.string,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isModalOpen: false,
    };
  }

  toggleModal = () => {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen,
    });
  };

  closeModal = () => {
    this.setState({isModalOpen: false});
  };

  onSnooze = duration => {
    this.props.onSnooze(duration);
    this.closeModal();
  };

  render() {
    return (
      <React.Fragment>
        <a
          title={this.props.tooltip}
          className={this.props.className}
          disabled={this.props.disabled}
          onClick={this.toggleModal}
        >
          <span>{t('zZz')}</span>
        </a>
        <Modal
          show={this.state.isModalOpen}
          title={t('Please confirm')}
          animation={false}
          onHide={this.closeModal}
          bsSize="sm"
        >
          <div className="modal-body">
            <h5>{t('How long should we ignore this issue?')}</h5>
            <ul className="nav nav-stacked nav-pills">
              <li>
                <a onClick={this.onSnooze.bind(this, Snooze['30MINUTES'])}>
                  {t('30 minutes')}
                </a>
              </li>
              <li>
                <a onClick={this.onSnooze.bind(this, Snooze['2HOURS'])}>{t('2 hours')}</a>
              </li>
              <li>
                <a onClick={this.onSnooze.bind(this, Snooze['24HOURS'])}>
                  {t('24 hours')}
                </a>
              </li>
              {/* override click event object w/ undefined to indicate "no duration" */}
              <li>
                <a onClick={this.onSnooze.bind(this, undefined)}>{t('Forever')}</a>
              </li>
            </ul>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={this.closeModal}>
              {t('Cancel')}
            </button>
          </div>
        </Modal>
      </React.Fragment>
    );
  }
}

export default SnoozeAction;
