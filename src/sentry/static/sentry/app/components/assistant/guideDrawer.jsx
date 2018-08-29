import React from 'react';
import PropTypes from 'prop-types';
import {withRouter} from 'react-router';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import Button from 'app/components/button';
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
  propTypes: {
    router: PropTypes.object,
  },
  mixins: [Reflux.listenTo(GuideStore, 'onGuideStateChange')],

  getInitialState() {
    return {
      guide: null,
      step: 0,
      messageVariables: {},
    };
  },

  componentDidMount() {
    fetchGuides();
  },

  onGuideStateChange(data) {
    this.setState({
      guide: data.currentGuide,
      step: data.currentStep,
      messageVariables: {
        orgSlug: data.org && data.org.slug,
        projectSlug: data.project && data.project.slug,
        numEvents: data.project && data.projectStats[parseInt(data.project.id, 10)],
      },
    });
  },

  /* Terminology:
   - A guide can be FINISHED by clicking one of the buttons in the last step.
   - A guide can be DISMISSED by x-ing out of it at any step except the last (where there is no x).
   - In both cases we consider it CLOSED.
  */
  handleFinish(useful) {
    recordFinish(this.state.guide.id, useful);
    closeGuide();
    // This is a bit racy. Technically the correct thing to do would be to wait until closeGuide
    // has updated the guide store and triggered a component state change. But it doesn't seem
    // to cause any issues in practice.
    if (useful && this.state.guide.cta_link) {
      let link = this.interpolate(this.state.guide.cta_link, this.state.messageVariables);
      this.props.router.push(link);
    }
  },

  handleDismiss(e) {
    e.stopPropagation();
    recordDismiss(this.state.guide.id, this.state.step);
    closeGuide();
  },

  interpolate(template, variables) {
    let regex = /\${([^{]+)}/g;
    return template.replace(regex, (match, g1) => {
      return variables[g1.trim()];
    });
  },

  render() {
    let {guide, step, messageVariables} = this.state;

    if (!guide) {
      return null;
    }

    if (step === 0) {
      return (
        <StyledCueContainer onClick={nextStep} className="assistant-cue">
          {<CueIcon hasGuide={true} />}
          <StyledCueText>{guide.cue}</StyledCueText>
          <div style={{display: 'flex'}} onClick={this.handleDismiss}>
            <CloseIcon />
          </div>
        </StyledCueContainer>
      );
    }

    let isTip = guide.guide_type === 'tip';

    return (
      <GuideContainer>
        <GuideInputRow>
          <CueIcon hasGuide={true} />
          <StyledTitle>{guide.steps[step - 1].title}</StyledTitle>
          {step < guide.steps.length && (
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
              __html: this.interpolate(guide.steps[step - 1].message, messageVariables),
            }}
          />
          <div style={{marginTop: '1em'}}>
            {step < guide.steps.length ? (
              <div>
                <Button priority="success" size="small" onClick={nextStep}>
                  {t('Next')} &rarr;
                </Button>
              </div>
            ) : (
              <div style={{textAlign: 'center'}}>
                {!isTip && <p>{t('Did you find this guide useful?')}</p>}
                <Button
                  priority="success"
                  size="small"
                  onClick={() => this.handleFinish(true)}
                >
                  {isTip ? guide.cta_text : <span>{t('Yes')} &nbsp; &#x2714;</span>}
                </Button>
                <Button
                  priority="success"
                  size="small"
                  style={{marginLeft: '0.25em'}}
                  onClick={() => this.handleFinish(false)}
                >
                  {isTip ? t('Dismiss') : <span>{t('No')} &nbsp; &#x2716;</span>}
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

export {GuideDrawer};
export default withRouter(GuideDrawer);
