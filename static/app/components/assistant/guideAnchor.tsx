import * as React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Query} from 'history';

import {
  closeGuide,
  dismissGuide,
  nextStep,
  recordFinish,
  registerAnchor,
  unregisterAnchor,
} from 'sentry/actionCreators/guides';
import {Guide} from 'sentry/components/assistant/types';
import Button from 'sentry/components/button';
import {Body as HovercardBody, Hovercard} from 'sentry/components/hovercard';
import {t, tct} from 'sentry/locale';
import GuideStore, {GuideStoreState} from 'sentry/stores/guideStore';
import space from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

type Props = {
  /** Hovercard renders the container */
  containerClassName?: string;
  offset?: string;
  onFinish?: () => void;
  // Shouldn't target be mandatory?
  position?: React.ComponentProps<typeof Hovercard>['position'];
  target?: string;
  to?: {
    pathname: string;
    query: Query;
  };
};

type State = {
  active: boolean;
  orgId: string | null;
  step: number;
  currentGuide?: Guide;
};

/**
 * A GuideAnchor puts an informative hovercard around an element.
 * Guide anchors register with the GuideStore, which uses registrations
 * from one or more anchors on the page to determine which guides can
 * be shown on the page.
 */
class GuideAnchor extends React.Component<Props, State> {
  state: State = {
    active: false,
    step: 0,
    orgId: null,
  };

  componentDidMount() {
    const {target} = this.props;
    target && registerAnchor(target);
  }

  componentDidUpdate(_prevProps, prevState) {
    if (this.containerElement.current && !prevState.active && this.state.active) {
      try {
        const {top} = this.containerElement.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset;
        const centerElement = top + scrollTop - window.innerHeight / 2;
        window.scrollTo({top: centerElement});
      } catch (err) {
        Sentry.captureException(err);
      }
    }
  }

  componentWillUnmount() {
    const {target} = this.props;
    target && unregisterAnchor(target);
    this.unsubscribe();
  }

  unsubscribe = GuideStore.listen(
    (data: GuideStoreState) => this.onGuideStateChange(data),
    undefined
  );

  containerElement = React.createRef<HTMLSpanElement>();

  onGuideStateChange(data: GuideStoreState) {
    const active =
      data.currentGuide?.steps[data.currentStep]?.target === this.props.target ?? false;

    this.setState({
      active,
      currentGuide: data.currentGuide ?? undefined,
      step: data.currentStep,
      orgId: data.orgId,
    });
  }

  /**
   * Terminology:
   *
   *  - A guide can be FINISHED by clicking one of the buttons in the last step
   *  - A guide can be DISMISSED by x-ing out of it at any step except the last (where there is no x)
   *  - In both cases we consider it CLOSED
   */
  handleFinish = (e: React.MouseEvent) => {
    e.stopPropagation();
    const {onFinish} = this.props;
    if (onFinish) {
      onFinish();
    }
    const {currentGuide, orgId} = this.state;
    if (currentGuide) {
      recordFinish(currentGuide.guide, orgId);
    }
    closeGuide();
  };

  handleNextStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    nextStep();
  };

  handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    const {currentGuide, step, orgId} = this.state;
    if (currentGuide) {
      dismissGuide(currentGuide.guide, step, orgId);
    }
  };

  getHovercardBody() {
    const {to} = this.props;
    const {currentGuide, step} = this.state;
    if (!currentGuide) {
      return null;
    }

    const totalStepCount = currentGuide.steps.length;
    const currentStepCount = step + 1;
    const currentStep = currentGuide.steps[step];
    const lastStep = currentStepCount === totalStepCount;
    const hasManySteps = totalStepCount > 1;

    // to clear `#assistant` from the url
    const href = window.location.hash === '#assistant' ? '#' : '';

    const dismissButton = (
      <DismissButton
        size="small"
        translucentBorder
        href={href}
        onClick={this.handleDismiss}
        priority="link"
      >
        {currentStep.dismissText || t('Dismiss')}
      </DismissButton>
    );

    return (
      <GuideContainer>
        <GuideContent>
          {currentStep.title && <GuideTitle>{currentStep.title}</GuideTitle>}
          <GuideDescription>{currentStep.description}</GuideDescription>
        </GuideContent>
        <GuideAction>
          <div>
            {lastStep ? (
              <React.Fragment>
                <StyledButton
                  size="small"
                  translucentBorder
                  to={to}
                  onClick={this.handleFinish}
                >
                  {currentStep.nextText ||
                    (hasManySteps ? t('Enough Already') : t('Got It'))}
                </StyledButton>
                {currentStep.hasNextGuide && dismissButton}
              </React.Fragment>
            ) : (
              <React.Fragment>
                <StyledButton
                  size="small"
                  translucentBorder
                  onClick={this.handleNextStep}
                  to={to}
                >
                  {currentStep.nextText || t('Next')}
                </StyledButton>
                {!currentStep.cantDismiss && dismissButton}
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
  }

  render() {
    const {children, position, offset, containerClassName} = this.props;
    const {active} = this.state;

    if (!active) {
      return children ? children : null;
    }

    return (
      <StyledHovercard
        show
        body={this.getHovercardBody()}
        tipColor={theme.purple300}
        position={position}
        offset={offset}
        containerClassName={containerClassName}
      >
        <span ref={this.containerElement}>{children}</span>
      </StyledHovercard>
    );
  }
}

export {GuideAnchor};

/**
 * Wraps the GuideAnchor so we don't have to render it if it's disabled
 * Using a class so we automatically have children as a typed prop
 */
type WrapperProps = {disabled?: boolean} & Props;

export default class GuideAnchorWrapper extends React.Component<WrapperProps> {
  render() {
    const {disabled, children, ...rest} = this.props;
    if (disabled || window.localStorage.getItem('hide_anchors') === '1') {
      return children || null;
    }
    return <GuideAnchor {...rest}>{children}</GuideAnchor>;
  }
}

const GuideContainer = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  gap: ${space(2)};
  text-align: center;
  line-height: 1.5;
  background-color: ${p => p.theme.purple300};
  border-color: ${p => p.theme.purple300};
  color: ${p => p.theme.white};
`;

const GuideContent = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  gap: ${space(1)};

  a {
    color: ${p => p.theme.white};
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
  gap: ${space(1)};
`;

const StyledButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeMedium};
  min-width: 40%;
`;

const DismissButton = styled(StyledButton)`
  margin-left: ${space(1)};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.white};
  }
  color: ${p => p.theme.white};
`;

const StepCount = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  text-transform: uppercase;
`;

const StyledHovercard = styled(Hovercard)`
  ${HovercardBody} {
    background-color: ${theme.purple300};
    margin: -1px;
    border-radius: ${theme.borderRadius};
    width: 300px;
  }
`;
