import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import Button from 'app/components/buttons/button';
import GuideStore from 'app/stores/guideStore';
import {t} from 'app/locale';
import {
  closeGuide,
  fetchGuides,
  nextStep,
  recordDismiss,
  recordFinish,
} from 'app/actionCreators/guides';
import {
  AssistantContainer,
  CloseIcon,
  CueContainer,
  CueIcon,
  CueText,
} from 'app/components/assistant/styles';

/* GuideDrawer is what slides up when the user clicks on a guide cue. */
const GuideDrawer = createReactClass({
  displayName: 'GuideDrawer',

  mixins: [Reflux.listenTo(GuideStore, 'onGuideStateChange')],

  getInitialState() {
    return {
      currentGuide: null,
      currentStep: 0,
      currentOrgSlug: null,
      currentProjectSlug: null,
    };
  },

  componentDidMount() {
    fetchGuides();
  },

  onGuideStateChange(data) {
    this.setState({
      currentGuide: data.currentGuide,
      currentStep: data.currentStep,
      currentOrgSlug: data.currentOrg ? data.currentOrg.slug : null,
      currentProjectSlug: data.currentProject ? data.currentProject.slug : null,
    });
  },

  /* Terminology:
   - A guide can be FINISHED by answering whether or not is was useful in the last step.
   - A guide can be DISMISSED by x-ing out of it at any time (including when it's cued).
   - In both cases we consider it CLOSED.
  */
  handleFinish(useful) {
    recordFinish(this.state.currentGuide.id, useful);
    closeGuide();
  },

  handleDismiss(e) {
    e.stopPropagation();
    recordDismiss(this.state.currentGuide.id, this.state.currentStep);
    closeGuide();
  },

  interpolate(template, variables) {
    let regex = /\${([^{]+)}/g;
    return template.replace(regex, (match, g1) => {
      return variables[g1.trim()];
    });
  },

  render() {
    let {currentGuide, currentStep} = this.state;

    if (!currentGuide) {
      return null;
    }

    if (currentStep === 0) {
      return (
        <StyledCueContainer onClick={nextStep} className="assistant-cue">
          {<CueIcon hasGuide={true} />}
          <StyledCueText>{currentGuide.cue}</StyledCueText>
          <div style={{display: 'flex'}} onClick={this.handleDismiss}>
            <CloseIcon />
          </div>
        </StyledCueContainer>
      );
    }

    let messageVariables = {
      orgSlug: this.state.currentOrgSlug,
      projectSlug: this.state.currentProjectSlug,
    };

    return (
      <GuideContainer>
        <GuideInputRow>
          <CueIcon hasGuide={true} />
          <StyledTitle>{currentGuide.steps[currentStep - 1].title}</StyledTitle>
          {currentStep < currentGuide.steps.length && (
            <div
              className="close-button"
              style={{display: 'flex'}}
              onClick={this.handleDismiss}
            >
              <CloseIcon />
            </div>
          )}
        </GuideInputRow>
        <StyledContent>
          <div
            dangerouslySetInnerHTML={{
              __html: this.interpolate(
                currentGuide.steps[currentStep - 1].message,
                messageVariables
              ),
            }}
          />
          <div style={{marginTop: '1em'}}>
            {currentStep < currentGuide.steps.length ? (
              <div>
                <Button priority="success" size="small" onClick={nextStep}>
                  {t('Next')} &rarr;
                </Button>
              </div>
            ) : (
              <div style={{textAlign: 'center'}}>
                <p>{t('Did you find this guide useful?')}</p>
                <Button
                  priority="success"
                  size="small"
                  onClick={() => this.handleFinish(true)}
                >
                  {t('Yes')} &nbsp; &#x2714;
                </Button>
                <Button
                  priority="success"
                  size="small"
                  style={{marginLeft: '0.25em'}}
                  onClick={() => this.handleFinish(false)}
                >
                  {t('No')} &nbsp; &#x2716;
                </Button>
              </div>
            )}
          </div>
        </StyledContent>
      </GuideContainer>
    );
  },
});

const StyledCueText = styled(CueText)`
  width: auto;
  opacity: 1;
  margin-left: 8px;
`;

const StyledCueContainer = styled(CueContainer)`
  right: 50%;
  transform: translateX(50%);
  background-color: ${p => p.theme.greenDark};
  border-color: ${p => p.theme.greenLight};
  color: ${p => p.theme.offWhite};
`;

const GuideContainer = styled(AssistantContainer)`
  background-color: ${p => p.theme.greenDark};
  border-color: ${p => p.theme.greenLight};
  color: ${p => p.theme.offWhite};
  height: auto;
  right: 50%;
  transform: translateX(50%);
`;

const GuideInputRow = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledTitle = styled('div')`
  font-size: 1.5em;
  margin-left: 0.5em;
  flex-grow: 1;
`;

const StyledContent = styled('div')`
  margin: 1.5rem;
  line-height: 1.5;

  a {
    color: ${p => p.theme.greenLight};
  }
`;

export default GuideDrawer;
