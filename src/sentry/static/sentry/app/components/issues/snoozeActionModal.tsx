import React from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {t} from 'app/locale';

enum SnoozeTimes {
  // all values in minutes
  THIRTY_MINUTES = 30,
  TWO_HOURS = 60 * 2,
  TWENTY_FOUR_HOURS = 60 * 24,
}

type Props = ModalRenderProps & {
  onSnooze: (duration: SnoozeTimes) => {};
};

const SnoozeActionModal = ({Body, Footer, closeModal, onSnooze}: Props) => {
  const handleSnooze = (duration: SnoozeTimes) => {
    onSnooze(duration);
    closeModal();
  };

  return (
    <React.Fragment>
      <Body>
        <h5>{t('How long should we ignore this issue?')}</h5>
        <ul className="nav nav-stacked nav-pills">
          <li>
            <a onClick={handleSnooze.bind(this, SnoozeTimes.THIRTY_MINUTES)}>
              {t('30 minutes')}
            </a>
          </li>
          <li>
            <a onClick={handleSnooze.bind(this, SnoozeTimes.TWO_HOURS)}>{t('2 hours')}</a>
          </li>
          <li>
            <a onClick={handleSnooze.bind(this, SnoozeTimes.TWENTY_FOUR_HOURS)}>
              {t('24 hours')}
            </a>
          </li>
          {/* override click event object w/ undefined to indicate "no duration" */}
          <li>
            <a onClick={handleSnooze.bind(this, undefined)}>{t('Forever')}</a>
          </li>
        </ul>
      </Body>
      <Footer>
        <button type="button" className="btn btn-default" onClick={closeModal}>
          {t('Cancel')}
        </button>
      </Footer>
    </React.Fragment>
  );
};

export default SnoozeActionModal;
