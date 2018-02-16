import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import {t} from '../../locale';
import {fetchGuides} from '../../actionCreators/guides';
import AssistantCue from './cue';
import SupportDrawer from './supportDrawer';
import GuideDrawer from './guideDrawer';
import GuideStore from '../../stores/guideStore';
import GuideActions from '../../actions/guideActions';

// AssistantHelper is responsible for rendering the cue message, guide drawer and support drawer.
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

  onGuideStateChange(data) {
    if (this.state.currentGuide != data.currentGuide) {
      this.setState({
        isDrawerOpen: false,
        currentGuide: data.currentGuide,
      });
    }
  },

  handleDrawerOpen() {
    this.setState({
      isDrawerOpen: true,
    });
    GuideActions.nextStep();
  },

  // This covers both the guide drawer being closed and the guide cue being dismissed.
  handleGuideClose() {
    GuideActions.closeGuide();
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
    return (
      <div className="assistant-container">
        {this.state.isDrawerOpen ? (
          <div className="assistant-drawer">
            {this.state.currentGuide ? (
              <GuideDrawer
                guide={this.state.currentGuide}
                onClose={this.handleGuideClose}
              />
            ) : (
              <SupportDrawer onClose={this.handleSupportDrawerClose} />
            )}
          </div>
        ) : (
          <AssistantCue text={cueText} onClick={this.handleDrawerOpen} />
        )}
      </div>
    );
  },
});

export default AssistantHelper;
