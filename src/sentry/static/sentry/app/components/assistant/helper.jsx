import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import {t} from '../../locale';
import {closeGuide, fetchGuides, nextStep} from '../../actionCreators/guides';
import SupportDrawer from './supportDrawer';
import GuideDrawer from './guideDrawer';
import GuideStore from '../../stores/guideStore';

// AssistantHelper is responsible for rendering the cue message, guide drawer and support drawer.
const AssistantHelper = createReactClass({
  displayName: 'AssistantHelper',

  mixins: [Reflux.listenTo(GuideStore, 'onGuideStateChange')],

  getInitialState() {
    return {
      isDrawerOpen: false,
      // currentGuide and currentStep are obtained from GuideStore.
      // Even though this component doesn't need currentStep, it's
      // child GuideDrawer does, and it's cleaner for only the parent
      // to subscribe to GuideStore and pass down the guide and step,
      // rather than have both parent and child subscribe to GuideStore.
      currentGuide: null,
      currentStep: 0,
    };
  },

  componentDidMount() {
    fetchGuides();
  },

  onGuideStateChange(data) {
    let newState = {
      currentGuide: data.currentGuide,
      currentStep: data.currentStep,
    };
    if (this.state.currentGuide != data.currentGuide) {
      newState.isDrawerOpen = false;
    }
    this.setState(newState);
  },

  handleDrawerOpen() {
    this.setState({
      isDrawerOpen: true,
    });
    nextStep();
  },

  handleSupportDrawerClose() {
    this.setState({
      isDrawerOpen: false,
    });
  },

  render() {
    const cueText = this.state.currentGuide
      ? this.state.currentGuide.cue
      : t('Need Help?');
    // isDrawerOpen and currentGuide/currentStep live in different places and are updated
    // non-atomically. So we need to guard against the inconsistent state of the drawer
    // being open and a guide being present, but currentStep not updated yet.
    // If this gets too complicated, it would be better to move isDrawerOpen into
    // GuideStore so we can update the state atomically in onGuideStateChange.
    let showDrawer = false;
    if (
      this.state.isDrawerOpen &&
      (!this.state.currentGuide || this.state.currentStep > 0)
    ) {
      showDrawer = true;
    }

    return (
      <div className="assistant-container">
        {showDrawer ? (
          <div className="assistant-drawer">
            {this.state.currentGuide ? (
              <GuideDrawer
                guide={this.state.currentGuide}
                step={this.state.currentStep}
                onClose={closeGuide}
              />
            ) : (
              <SupportDrawer onClose={this.handleSupportDrawerClose} />
            )}
          </div>
        ) : (
          <a onClick={this.handleDrawerOpen} className="assistant-cue">
            {cueText}
          </a>
        )}
      </div>
    );
  },
});

export default AssistantHelper;
