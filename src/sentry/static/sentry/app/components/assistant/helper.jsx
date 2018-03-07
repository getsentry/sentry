import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import {t} from '../../locale';
import {closeGuide, fetchGuides, nextStep} from '../../actionCreators/guides';
import SupportSearch from './supportSearch';
import GuideDrawer from './guideDrawer';
import GuideStore from '../../stores/guideStore';
import QuestionMarkIcon from './questionMarkIcon';
import AssistantContainer from './assistantContainer';

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

  handleDismiss() {
    dismiss(this.state.currentGuide.id);
    closeGuide();
  },

  render() {
    // isDrawerOpen and currentGuide/currentStep live in different places and are updated
    // non-atomically. So we need to guard against the inconsistent state of the drawer
    // being open and a guide being present, but currentStep not updated yet.
    // If this gets too complicated, it would be better to move isDrawerOpen into
    // GuideStore so we can update the state atomically in onGuideStateChange.
    let showDrawer = false;
    let {currentGuide, currentStep, isDrawerOpen} = this.state;
    let isGuideCued = currentGuide !== null;

    const cueText = isGuideCued ? currentGuide.cue : t('Need Help?');
    if (isDrawerOpen && (!isGuideCued || currentStep > 0)) {
      showDrawer = true;
    }

    return (
      <div>
        {showDrawer ? (
          <AssistantDrawer>
            {this.state.currentGuide ? (
              <GuideDrawer
                guide={currentGuide}
                step={currentStep}
                onFinish={closeGuide}
                onDismiss={this.handleDismiss}
              />
            ) : (
              <SupportSearch onClose={this.handleSupportDrawerClose} />
            )}
          </AssistantDrawer>
        ) : (
          <StyledAssistantContainer
            onClick={this.handleDrawerOpen}
            className="assistant-cue"
          >
            <QuestionMarkIcon />
            <StyledCueText>
              {cueText}
              {isGuideCued && (
                <a onClick={this.handleDismiss} className="icon-close assistant-cue" />
              )}
            </StyledCueText>
          </StyledAssistantContainer>
        )}
      </div>
    );
  },
});

const AssistantDrawer = styled('div')``;

const StyledCueText = styled('span')`
  width: 0;
  overflow: hidden;
  opacity: 0;
  transition: 0.2s all;
  white-space: nowrap;
`;

const StyledAssistantContainer = styled(AssistantContainer)`
  display: flex;
  align-items: center;

  &:hover {
    cursor: pointer;

    ${StyledCueText} {
      width: 5.5em;
      opacity: 1;
      margin: 0 0.5em;
    }
  }
`;

export default AssistantHelper;
