import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import {fetchGuides} from '../../actionCreators/guides';
import AssistantHandle from './handle';
import SupportDrawer from './supportDrawer';
import GuideDrawer from './guideDrawer';
import GuideStore from '../../stores/guideStore';
import GuideActions from '../../actions/guideActions';

const AssistantHelper = createReactClass({
  displayName: 'AssistantHelper',

  mixins: [Reflux.listenTo(GuideStore, 'onGuideStateChange')],

  getInitialState() {
    return {
      isDrawerOpen: false,
      currentGuide: null,
    };
  },

  componentDidMount() {
    fetchGuides();
  },

  /*componentDidUpdate(prevProps, prevState) {
    const guide = GuideStore.getCurrentGuide();
    // Scroll to the element referenced by the current guide.
    if (
      guide &&
      this.state.isDrawerOpen &&
      this.state.currentStep !== prevState.currentStep
    ) {
      const target = guide.steps[this.state.currentStep].target;
      GuideStore.setStep(this.state.currentStep);
      if (target) {
        $('html, body').animate(
          {
            scrollTop: $('#' + target).offset().top,
          },
          1000
        );
      }
    }
  },*/

  onGuideStateChange(data) {
    if (this.state.currentGuide != data.currentGuide) {
      this.setState({
        isDrawerOpen: false,
        currentGuide: data.currentGuide,
      });
    }
  },

  onDrawerOpen() {
    this.setState({
      isDrawerOpen: true,
    });
    GuideActions.nextStep();
  },

  // This covers both the guide drawer being closed and the guide handle (cue) being dismissed.
  onGuideClose() {
    GuideActions.guideClose();
  },

  onSupportDrawerClose() {
    this.setState({
      isDrawerOpen: false,
    });
  },

  render() {
    const cue = this.state.currentGuide ? this.state.currentGuide.cue : 'Need Help?';
    return (
      <div className="assistant-container">
        {this.state.isDrawerOpen ? (
          <div className="assistant-drawer">
            {this.state.currentGuide ? (
              <GuideDrawer
                guide={this.state.currentGuide}
                closeHandler={this.onGuideClose}
              />
            ) : (
              <SupportDrawer closeHandler={this.onSupportDrawerClose} />
            )}
          </div>
        ) : (
          <AssistantHandle cue={cue} onClick={this.onDrawerOpen} />
        )}
      </div>
    );
  },
});

export default AssistantHelper;
