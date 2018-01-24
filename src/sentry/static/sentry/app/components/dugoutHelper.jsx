import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import classNames from 'classnames';
import DugoutSearch from './dugoutSearch';
import ApiMixin from '../mixins/apiMixin';
import GuideStore from '../stores/guideStore';

const DugoutHelper = createReactClass({
  displayName: 'DugoutHelper',

  // mixins: [ApiMixin, Reflux.listenTo(GuideStore, 'onGuideChange')],
  mixins: [ApiMixin, Reflux.connect(GuideStore, 'guide')],

  getInitialState(props) {
    return {
      guide: null,
    };
  },

  isFirstStep() {
    return GuideStore._internal.step == -1;
  },

  currentStep() {
    return GuideStore.getCurrentStep() || GuideStore.getFirstStep();
  },

  currentGuide() {
    return GuideStore.getCurrentGuide();
  },

  onGuideChange(guideState) {
    if (GuideStore.getCurrentStep()) {
      const {title, description} = GuideStore.getCurrentStep();
      this.setState({title, description});
    }
  },

  largeMessage() {
    return this.isFirstStep() ? (
      ''
    ) : (
      <div className="dugout-message-large">
        <div className="dugout-message-large-title">{this.state.guide.title}</div>
        <div className="dugout-message-large-text">{this.state.guide.description}</div>
      </div>
    );
  },

  clickedHandle() {
    if (this.isFirstStep()) GuideStore.completeStep();
  },

  render() {
    if (!this.guide) {
      return <DugoutSearch subscription={2} />; //placeholder subscription
    } else {
      return (
        <div>
          <div
            onClick={this.clickedHandle}
            className={classNames('dugout-drawer', {
              'dugout-drawer--engaged': !this.isFirstStep(),
            })}
          >
            <div className="dugout-message">{this.state.guide.starting_message}</div>

            {this.largeMessage()}
          </div>
        </div>
      );
    }
  },
});

export default DugoutHelper;
