import React from 'react';
import {browserHistory} from 'react-router';
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

  componentWillMount() {
    this.handleLocation(window.location);
    this.unlisten = browserHistory.listen((location, action) => {
      this.handleLocation(location);
    });
  },

  componentWillUnmount() {
    this.unlisten();
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

  handleLocation(location) {
    if (location.pathname.includes('/issues/')) {
      this.setState({guide: this.guides.issues});
    } else {
      this.setState({guide: null});
    }
  },

  guides: {
    issues: {
      cue: 'Welcome to the Issue page. Click here for a tour!',
      steps: [
        {
          title: '1. Stacktraces',
          message:
            'See which line in your code caused the error and the entire call ' +
            'stack at that point. Get additional context like stack locals, ' +
            'browser environment, and any custom data sent by the client.',
        },
        {
          title: '2. Breadcrumbs',
          message:
            'Breadcrumbs allow you to see the events that happened before the error. ' +
            'This is often useful to understand what may have triggered the error ' +
            'and includes things like HTTP requests, database calls, and any other ' +
            'custom data you record. Breadcrumbs also integrate seamlessly with many ' +
            'popular web frameworks.',
        },
      ],
    },
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

  onButtonClick() {
    this.setState({
      isDrawerOpen: true,
      currentStep: 0,
    });
  },

  nextHandler() {
    this.setState({
      currentStep: this.state.currentStep + 1,
    });
  },

  closeHandler() {
    this.setState({
      isDrawerOpen: false,
    });
  },

  render() {
    const cue = this.state.guide ? this.state.guide.cue : 'Need Help?';
    return (
      <div className="dugout-container">
        {this.state.isDrawerOpen ? (
          <div className="dugout-drawer">
            {this.state.guide ? (
              <GuideDrawer
                onClick={this.onDrawerClick}
                guide={this.state.guide}
                step={this.state.currentStep}
                nextHandler={this.nextHandler}
                closeHandler={this.closeHandler}
              />
            ) : (
              <SupportDrawer onClick={this.onDrawerClick} />
            )}
          </div>
        ) : (
          <DugoutHandle cue={cue} onClick={this.onButtonClick} />
        )}
      </div>
    );
  },
});

export default DugoutHelper;
