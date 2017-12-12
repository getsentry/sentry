import React from 'react';
import Reflux from 'reflux';
import styled from 'react-emotion';

import {t} from '../../../locale';
import {undo} from '../../../actionCreators/settingsIndicator';
import SettingsIndicatorStore from '../../../stores/settingsIndicatorStore';

const Container = styled.div`
  position: fixed;
  bottom: 32px;
  right: 40px;
  font-size: 15px;
  color: ${p => p.theme.gray5};
  background: #fff;
  border-radius: 3px;
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  padding: 12px 24px;
  line-height: 1;
`;

const Undo = styled.div`
  display: inline-block;
  color: ${p => p.theme.gray2};
  padding-left: 16px;
  margin-left: 16px;
  border-left: 1px solid ${p => p.theme.borderLight};
  cursor: pointer;

  &:hover {
    color: ${p => p.theme.gray3};
  }
`;

const SettingsActivity = React.createClass({
  mixins: [Reflux.connect(SettingsIndicatorStore, 'activity')],

  getInitialState() {
    return {
      activity: null,
    };
  },

  render() {
    let {activity} = this.state;

    if (!activity) {
      return null;
    }

    let showUndo = activity.type !== 'error' && activity.type !== 'undo';

    return (
      <Container type={activity.type}>
        {activity.message}
        {showUndo && <Undo onClick={undo}>{t('Undo')}</Undo>}
      </Container>
    );
  },
});

export default SettingsActivity;
