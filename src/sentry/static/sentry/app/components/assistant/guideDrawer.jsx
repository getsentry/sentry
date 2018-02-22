import PropTypes from 'prop-types';
import React from 'react';
import Button from '../buttons/button';
import {t} from '../../locale';
import {dismiss, markUseful, nextStep} from '../../actionCreators/guides';

// GuideDrawer is what slides up when the user clicks on a guide cue.
export default class GuideDrawer extends React.Component {
  static propTypes = {
    guide: PropTypes.object.isRequired,
    step: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
  };

  handleUseful = useful => {
    markUseful(this.props.guide.id, useful);
    this.props.onClose();
  };

  handleDismiss = () => {
    dismiss(this.props.guide.id);
    this.props.onClose();
  };

  render() {
    return (
      <div>
        <div className="assistant-drawer-title">
          {this.props.guide.steps[this.props.step - 1].title}
        </div>
        <div className="assistant-drawer-message">
          {this.props.guide.steps[this.props.step - 1].message}
        </div>
        <div>
          {this.props.step < this.props.guide.steps.length ? (
            <div>
              <Button onClick={nextStep}>{t('Next')} &rarr;</Button>
              <Button onClick={this.handleDismiss}>{t('Dismiss')}</Button>
            </div>
          ) : (
            <div>
              <p>{t('Did you find this guide useful?')}</p>
              <Button onClick={() => this.handleUseful(true)}>
                {t('Yes')} &nbsp; &#x2714;
              </Button>
              <Button onClick={() => this.handleUseful(false)}>
                {t('No')} &nbsp; &#x2716;
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
