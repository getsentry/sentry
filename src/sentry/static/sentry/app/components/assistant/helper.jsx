import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import {t} from '../../locale';
import {dismiss, closeGuide, fetchGuides, nextStep} from '../../actionCreators/guides';
import SupportDrawer from './supportDrawer';
import GuideDrawer from './guideDrawer';
import GuideStore from '../../stores/guideStore';
import CueIcon from './cueIcon';
import AssistantContainer from './assistantContainer';
import CloseIcon from './closeIcon';

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

  handleDismiss(e) {
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
      <StyledHelper>
        {showDrawer &&
          this.state.currentGuide && (
            <GuideDrawer
              guide={currentGuide}
              step={currentStep}
              onFinish={closeGuide}
              onDismiss={this.handleDismiss}
            />
          )}

        {showDrawer &&
          !this.state.currentGuide && (
            <SupportDrawer onClose={this.handleSupportDrawerClose} />
          )}

        {!showDrawer && (
          <StyledAssistantContainer
            onClick={this.handleDrawerOpen}
            className="assistant-cue"
            hasGuide={this.state.currentGuide}
          >
            <CueIcon hasGuide={this.state.currentGuide} />
            <StyledCueText hasGuide={this.state.currentGuide}>{cueText}</StyledCueText>
            {isGuideCued && (
              <div style={{display: 'flex'}} onClick={this.handleDismiss}>
                <CloseIcon />
              </div>
            )}
          </StyledAssistantContainer>
        )}
      </StyledHelper>
    );
  },
});

//this globally controls the size of the component
const StyledHelper = styled('div')`
  font-size: 1.4rem;
`;

const StyledCueText = styled('span')`
  width: 0px;
  overflow: hidden;
  opacity: 0;
  transition: 0.2s all;
  white-space: nowrap;
  color: ${p => p.purpleDark};

  ${p =>
    p.hasGuide &&
    `
    width: auto;
    opacity: 1;
    margin-left: 8px;
  `};
`;

const StyledAssistantContainer = styled(AssistantContainer)`
  display: flex;
  align-items: center;
  cursor: pointer;
  max-width: 300px;
  min-width: 0;
  width: auto;

  &:hover ${StyledCueText} {
    ${p =>
      !p.hasGuide &&
      `
      width: 6em;
      // this is roughly long enough for the copy 'need help?'
      // at any base font size. if you change the copy, change this value
      opacity: 1;
      margin: 0 0.5em;
    `};
  }

  ${p =>
    p.hasGuide &&
    `
    background-color: ${p.theme.greenDark};
    border-color: ${p.theme.greenLight};
    color: ${p.theme.offWhite};
    `};
`;

export default AssistantHelper;
