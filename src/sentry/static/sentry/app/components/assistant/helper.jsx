import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import {t} from '../../locale';
import {
  closeGuideOrSupport,
  fetchGuides,
  nextStep,
  recordDismiss,
} from '../../actionCreators/guides';
import SupportDrawer from './supportDrawer';
import GuideDrawer from './guideDrawer';
import GuideStore from '../../stores/guideStore';
import CueIcon from './cueIcon';
import AssistantContainer from './assistantContainer';
import CloseIcon from './closeIcon';
import HookStore from '../../stores/hookStore';

// AssistantHelper is responsible for rendering the cue message, guide drawer and support drawer.
const AssistantHelper = createReactClass({
  displayName: 'AssistantHelper',

  mixins: [Reflux.listenTo(GuideStore, 'onGuideStateChange')],

  getInitialState() {
    return {
      currentGuide: null,
      // currentStep is applicable to the Need-Help button too. When currentGuide
      // is null, if currentStep is 0 the Need-Help button is cued, and if it's > 0
      // the support widget is open.
      currentStep: 0,
      currentOrg: null,
    };
  },

  componentDidMount() {
    fetchGuides();
  },

  componentDidUpdate(prevProps, prevState) {
    if (this.state.currentGuide && !prevState.currentGuide) {
      HookStore.get('analytics:event').forEach(cb =>
        cb('assistant.guide_cued', {
          guide: this.state.currentGuide.id,
          cue: this.state.currentGuide.cue,
        })
      );
    }
  },

  onGuideStateChange(data) {
    this.setState({
      currentGuide: data.currentGuide,
      currentStep: data.currentStep,
    });
  },

  // Terminology:
  // - A guide can be FINISHED by answering whether or not is was useful in the last step.
  // - A guide can be DISMISSED by x-ing out of it at any time (including when it's cued).
  // In both cases we consider it CLOSED.
  handleGuideDismiss(e) {
    e.stopPropagation();
    recordDismiss(this.state.currentGuide.id, this.state.currentStep);
    closeGuideOrSupport();
  },

  render() {
    let {currentGuide, currentStep} = this.state;
    const cueText = (currentGuide && currentGuide.cue) || t('Need Help?');

    return (
      <StyledHelper>
        {currentGuide !== null &&
          currentStep > 0 && (
            <GuideDrawer
              guide={currentGuide}
              step={currentStep}
              onFinish={closeGuideOrSupport}
              onDismiss={this.handleGuideDismiss}
              orgSlug={
                GuideStore.state.currentOrg ? GuideStore.state.currentOrg.slug : null
              }
            />
          )}

        {currentGuide === null &&
          currentStep > 0 && <SupportDrawer onClose={closeGuideOrSupport} />}

        {!currentStep && (
          <StyledAssistantContainer
            onClick={nextStep}
            className="assistant-cue"
            hasGuide={currentGuide}
          >
            <CueIcon hasGuide={currentGuide} />
            <StyledCueText hasGuide={currentGuide}>{cueText}</StyledCueText>
            {currentGuide && (
              <div style={{display: 'flex'}} onClick={this.handleGuideDismiss}>
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
  @media (max-width: 600px) {
    display: none;
  }
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
