import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import DugoutHandle from './handle';
import SupportDrawer from './supportDrawer';
import GuideDrawer from './guideDrawer';
import ApiMixin from '../../mixins/apiMixin';
import GuideStore from '../../stores/guideStore';

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
    let open = true;
    let shortMessage = 'Need Help?'; // from GuideStore
    let mode = 'support'; // alt is guide

    return (
      <div>
        <DugoutHandle open={open} message={shortMessage} />
        <div className="dugout-drawer">
          {mode == 'support' && open ? <SupportDrawer /> : <GuideDrawer />}
        </div>
      </div>
    );
  },
});

export default DugoutHelper;
