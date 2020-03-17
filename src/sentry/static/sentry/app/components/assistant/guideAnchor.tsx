import {ClassNames} from '@emotion/core';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/browser';

import {
  closeGuide,
  dismissGuide,
  nextStep,
  recordFinish,
  registerAnchor,
  unregisterAnchor,
} from 'app/actionCreators/guides';
import {CloseIcon} from 'app/components/assistant/styles';
import {Guide} from 'app/components/assistant/types';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import GuideStore from 'app/stores/guideStore';
import Hovercard, {Body as HovercardBody} from 'app/components/hovercard';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

type Props = {
  target?: string;
  position?: string;
};

type State = {
  active: boolean;
  orgId: string | null;
  currentGuide?: Guide;
  step?: number;
};

/**
 * A GuideAnchor puts an informative hovercard around an element.
 * Guide anchors register with the GuideStore, which uses registrations
 * from one or more anchors on the page to determine which guides can
 * be shown on the page.
 */
const GuideAnchor = createReactClass<Props, State>({
  propTypes: {
    target: PropTypes.string,
    position: PropTypes.string,
  },

  mixins: [Reflux.listenTo(GuideStore, 'onGuideStateChange') as any],

  getInitialState() {
    return {
      active: false,
      orgId: null,
    };
  },

  componentDidMount() {
    const {target} = this.props;
    target && registerAnchor(target);
  },

  componentDidUpdate(_prevProps, prevState) {
    if (this.containerElement && !prevState.active && this.state.active) {
      try {
        const {top} = this.containerElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset;
        const centerElement = top + scrollTop - window.innerHeight / 2;
        window.scrollTo({top: centerElement});
      } catch (err) {
        Sentry.captureException(err);
      }
    }
  },

  componentWillUnmount() {
    const {target} = this.props;
    target && unregisterAnchor(target);
  },

  onGuideStateChange(data) {
    const active =
      data.currentGuide &&
      data.currentGuide.steps[data.currentStep].target === this.props.target;
    this.setState({
      active,
      currentGuide: data.currentGuide,
      step: data.currentStep,
      orgId: data.orgId,
    });
  },

  /**
   * Terminology:
   *
   *  - A guide can be FINISHED by clicking one of the buttons in the last step
   *  - A guide can be DISMISSED by x-ing out of it at any step except the last (where there is no x)
   *  - In both cases we consider it CLOSED
   */
  handleFinish(e) {
    e.stopPropagation();
    const {currentGuide, orgId} = this.state;
    recordFinish(currentGuide.guide, orgId);
    closeGuide();
  },

  handleNextStep(e) {
    e.stopPropagation();
    nextStep();
  },

  handleDismiss(e) {
    e.stopPropagation();
    const {currentGuide, step, orgId} = this.state;
    dismissGuide(currentGuide.guide, step, orgId);
  },

  getHovercardExpBody() {
    const {currentGuide, step} = this.state;

    const totalStepCount = currentGuide.steps.length;
    const currentStepCount = step + 1;
    const currentStep = currentGuide.steps[step];
    const lastStep = currentStepCount === totalStepCount;
    const hasManySteps = totalStepCount > 1;

    return (
      <GuideExpContainer>
        <GuideContent>
          <GuideTitle>{currentStep.title}</GuideTitle>
          <GuideDescription>{currentStep.description}</GuideDescription>
        </GuideContent>
        <GuideAction>
          {lastStep ? (
            <div>
              <StyledButton size="small" onClick={this.handleFinish}>
                {hasManySteps ? t('Enough Already') : t('Got It')}
              </StyledButton>
            </div>
          ) : (
            <div>
              <DismissButton
                priority="primary"
                size="small"
                onClick={this.handleDismiss}
                href="#"
              >
                {t('Dismiss')}
              </DismissButton>
              <StyledButton size="small" onClick={this.handleNextStep}>
                {t('Next')}
              </StyledButton>
            </div>
          )}

          {hasManySteps && (
            <StepCount>{`${currentStepCount} OF ${totalStepCount}`}</StepCount>
          )}
        </GuideAction>
      </GuideExpContainer>
    );
  },

  getHovercardBody() {
    const {active, currentGuide, step} = this.state;
    if (!active) {
      return this.props.children ? this.props.children : null;
    }

    return (
      <GuideContainer>
        <GuideInputRow>
          <StyledTitle>{currentGuide.steps[step].title}</StyledTitle>
          {step < currentGuide.steps.length - 1 && (
            <CloseLink onClick={this.handleDismiss} href="#" data-test-id="close-button">
              <CloseIcon />
            </CloseLink>
          )}
        </GuideInputRow>
        <StyledContent>
          <div>{currentGuide.steps[step].description}</div>
          <Actions>
            <div>
              {step < currentGuide.steps.length - 1 ? (
                <Button priority="success" size="small" onClick={this.handleNextStep}>
                  {t('Next')}
                </Button>
              ) : (
                <Button priority="success" size="small" onClick={this.handleFinish}>
                  {t(currentGuide.steps.length === 1 ? 'Got It' : 'Done')}
                </Button>
              )}
            </div>
          </Actions>
        </StyledContent>
      </GuideContainer>
    );
  },

  renderHovercardExp() {
    const {children, position} = this.props;

    return (
      <StyledHovercard
        show
        body={this.getHovercardExpBody()}
        tipColor={theme.purple}
        position={position}
      >
        <span ref={el => (this.containerElement = el)}>{children}</span>
      </StyledHovercard>
    );
  },

  render() {
    const {active} = this.state;
    const {children, position} = this.props;
    if (!active) {
      return children ? children : null;
    }

    const user = ConfigStore.get('user');
    const hasExperiment = user?.experiments?.AssistantGuideExperiment === 1;

    return hasExperiment ? (
      this.renderHovercardExp()
    ) : (
      <ClassNames>
        {({css}) => (
          <Hovercard
            show
            body={this.getHovercardBody()}
            bodyClassName={css`
              background-color: ${theme.greenDark};
              margin: -1px;
            `}
            tipColor={theme.greenDark}
            position={position}
          >
            <span ref={el => (this.containerElement = el)}>{children}</span>
          </Hovercard>
        )}
      </ClassNames>
    );
  },
});

const GuideContainer = styled('div')`
  background-color: ${p => p.theme.greenDark};
  border-color: ${p => p.theme.greenLight};
  color: ${p => p.theme.offWhite};
`;

const CloseLink = styled('a')`
  color: ${p => p.theme.offWhite};
  &:hover {
    color: ${p => p.theme.offWhite};
  }
  display: flex;
`;

const GuideInputRow = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledTitle = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  flex-grow: 1;
`;

const StyledContent = styled('div')`
  margin-top: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.5;

  a {
    color: ${p => p.theme.greenLight};
  }
`;

const Actions = styled('div')`
  margin-top: 1em;
`;

// experiment styles
const GuideExpContainer = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  grid-gap: ${space(2)};
  text-align: center;
  line-height: 1.5;
  background-color: ${p => p.theme.purple};
  border-color: ${p => p.theme.purple};
  color: ${p => p.theme.offWhite};
`;

const GuideContent = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  grid-gap: ${space(1)};

  a {
    color: ${p => p.theme.offWhite};
    text-decoration: underline;
  }
`;

const GuideTitle = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const GuideDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const GuideAction = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  grid-gap: ${space(1)};
`;

const StyledButton = styled(Button)`
  border-color: ${p => p.theme.offWhite};
  min-width: 40%;
`;

const DismissButton = styled(StyledButton)`
  margin-right: ${space(1)};

  &:hover,
  &:focus,
  &:active {
    border-color: ${p => p.theme.offWhite};
  }
`;

const StepCount = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
`;

const StyledHovercard = styled(Hovercard)`
  ${HovercardBody} {
    background-color: ${theme.purple};
    margin: -1px;
    border-radius: ${theme.borderRadius};
  }
`;

export default GuideAnchor;
