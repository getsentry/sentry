import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as React from 'react';
import Reflux from 'reflux';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {
  closeGuide,
  dismissGuide,
  nextStep,
  recordFinish,
  registerAnchor,
  unregisterAnchor,
} from 'app/actionCreators/guides';
import {Guide} from 'app/components/assistant/types';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import GuideStore from 'app/stores/guideStore';
import Hovercard, {Body as HovercardBody} from 'app/components/hovercard';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

type Props = {
  target?: string;
  position?: string;
  disabled?: boolean;
  offset?: string;
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
    disabled: PropTypes.bool,
    offset: PropTypes.string,
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
  handleFinish(e: React.MouseEvent) {
    e.stopPropagation();
    const {currentGuide, orgId} = this.state;
    recordFinish(currentGuide.guide, orgId);
    closeGuide();
  },

  handleNextStep(e: React.MouseEvent) {
    e.stopPropagation();
    nextStep();
  },

  handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    const {currentGuide, step, orgId} = this.state;
    dismissGuide(currentGuide.guide, step, orgId);
  },

  getHovercardBody() {
    const {currentGuide, step} = this.state;

    const totalStepCount = currentGuide.steps.length;
    const currentStepCount = step + 1;
    const currentStep = currentGuide.steps[step];
    const lastStep = currentStepCount === totalStepCount;
    const hasManySteps = totalStepCount > 1;

    return (
      <GuideContainer>
        <GuideContent>
          <GuideTitle>{currentStep.title}</GuideTitle>
          <GuideDescription>{currentStep.description}</GuideDescription>
        </GuideContent>
        <GuideAction>
          <div>
            {lastStep ? (
              <StyledButton
                size="small"
                href="#" // to clear `#assistant` from the url
                onClick={this.handleFinish}
              >
                {hasManySteps ? t('Enough Already') : t('Got It')}
              </StyledButton>
            ) : (
              <React.Fragment>
                <DismissButton
                  priority="primary"
                  size="small"
                  href="#" // to clear `#assistant` from the url
                  onClick={this.handleDismiss}
                >
                  {t('Dismiss')}
                </DismissButton>
                <StyledButton size="small" onClick={this.handleNextStep}>
                  {t('Next')}
                </StyledButton>
              </React.Fragment>
            )}
          </div>

          {hasManySteps && (
            <StepCount>
              {tct('[currentStepCount] of [totalStepCount]', {
                currentStepCount,
                totalStepCount,
              })}
            </StepCount>
          )}
        </GuideAction>
      </GuideContainer>
    );
  },

  render() {
    const {disabled, children, position, offset} = this.props;
    const {active} = this.state;

    if (!active || disabled) {
      return children ? children : null;
    }

    return (
      <StyledHovercard
        show
        body={this.getHovercardBody()}
        tipColor={theme.purple400}
        position={position}
        offset={offset}
      >
        <span ref={el => (this.containerElement = el)}>{children}</span>
      </StyledHovercard>
    );
  },
});

const GuideContainer = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  grid-gap: ${space(2)};
  text-align: center;
  line-height: 1.5;
  background-color: ${p => p.theme.purple400};
  border-color: ${p => p.theme.purple400};
  color: ${p => p.theme.gray100};
`;

const GuideContent = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  grid-gap: ${space(1)};

  a {
    color: ${p => p.theme.gray100};
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
  border-color: ${p => p.theme.borderLighter};
  min-width: 40%;
`;

const DismissButton = styled(StyledButton)`
  margin-right: ${space(1)};

  &:hover,
  &:focus,
  &:active {
    border-color: ${p => p.theme.borderLighter};
  }
`;

const StepCount = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  text-transform: uppercase;
`;

const StyledHovercard = styled(Hovercard)`
  ${HovercardBody} {
    background-color: ${theme.purple400};
    margin: -1px;
    border-radius: ${theme.borderRadius};
  }
`;

export default GuideAnchor;
