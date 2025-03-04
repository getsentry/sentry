import {Component, Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Query} from 'history';

import {
  closeGuide,
  dismissGuide,
  nextStep,
  recordFinish,
  registerAnchor,
  unregisterAnchor,
} from 'sentry/actionCreators/guides';
import type {Guide} from 'sentry/components/assistant/types';
import ButtonBar from 'sentry/components/buttonBar';
import type {Hovercard} from 'sentry/components/hovercard';
import {TourAction, TourGuide} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import type {GuideStoreState} from 'sentry/stores/guideStore';
import GuideStore from 'sentry/stores/guideStore';
import type {Organization} from 'sentry/types/organization';

type Props = {
  target: string;
  children?: React.ReactNode;
  /**
   * Hovercard renders the container
   */
  containerClassName?: string;
  offset?: number;
  /**
   * Trigger when the guide is completed (all steps have been clicked through)
   */
  onFinish?: (e: React.MouseEvent) => void;
  /**
   * Triggered when any step is completed (including the last step)
   */
  onStepComplete?: (e: React.MouseEvent) => void;
  position?: React.ComponentProps<typeof Hovercard>['position'];
  to?: {
    pathname: string;
    query: Query;
  };
};

function ScrollToGuide({children}: {children: React.ReactNode}) {
  const containerElement = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerElement.current) {
      try {
        const {top} = containerElement.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset;
        const centerElement = top + scrollTop - window.innerHeight / 2;
        window.scrollTo({top: centerElement});
      } catch (err) {
        Sentry.captureException(err);
      }
    }
  }, [containerElement]);

  return <span ref={containerElement}>{children}</span>;
}

type State = {
  active: boolean;
  org: Organization | null;
  orgId: string | null;
  orgSlug: string | null;
  step: number;
  currentGuide?: Guide;
};

class BaseGuideAnchor extends Component<Props, State> {
  state: State = {
    active: false,
    step: 0,
    orgId: null,
    orgSlug: null,
    org: null,
  };

  componentDidMount() {
    const {target} = this.props;
    registerAnchor(target);
    this.unsubscribe = GuideStore.listen(
      (data: GuideStoreState) => this.onGuideStateChange(data),
      undefined
    );
  }

  componentWillUnmount() {
    const {target} = this.props;
    unregisterAnchor(target);
    this.unsubscribe?.();
  }

  unsubscribe: ReturnType<typeof GuideStore.listen> | undefined;

  onGuideStateChange(data: GuideStoreState) {
    const active =
      data.currentGuide?.steps[data.currentStep]?.target === this.props.target &&
      !data.forceHide;

    this.setState({
      active,
      currentGuide: data.currentGuide ?? undefined,
      step: data.currentStep,
      orgId: data.orgId,
      orgSlug: data.orgSlug,
      org: data.organization,
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
    this.props.onStepComplete?.(e);
    this.props.onFinish?.(e);

    const {currentGuide, orgId, orgSlug, org} = this.state;
    if (currentGuide) {
      recordFinish(currentGuide.guide, orgId, orgSlug, org);
    }
    closeGuide();
  };

  handleNextStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    this.props.onStepComplete?.(e);
    nextStep();
  };

  handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    const {currentGuide, step, orgId} = this.state;
    if (currentGuide) {
      dismissGuide(currentGuide.guide, step, orgId);
    }
  };

  render() {
    const {children, position, offset, containerClassName, to} = this.props;
    const {active, currentGuide, step} = this.state;

    if (!active) {
      return children ? children : null;
    }

    const totalStepCount = currentGuide?.steps.length ?? 0;
    const currentStepCount = step + 1;
    const currentStep = currentGuide?.steps[step]!;
    const lastStep = currentStepCount === totalStepCount;
    const hasManySteps = totalStepCount > 1;

    return (
      <TourGuide
        isOpen
        title={currentStep.title}
        description={currentStep.description}
        stepCount={currentStepCount}
        stepTotal={totalStepCount}
        handleDismiss={e => {
          this.handleDismiss(e);
          window.location.hash = '';
        }}
        wrapperComponent={GuideAnchorWrapper}
        actions={
          <ButtonBar gap={1}>
            {lastStep ? (
              <TourAction size="xs" to={to} onClick={this.handleFinish}>
                {currentStep.nextText ||
                  (hasManySteps ? t('Enough Already') : t('Got It'))}
              </TourAction>
            ) : (
              <TourAction size="xs" onClick={this.handleNextStep} to={to}>
                {currentStep.nextText || t('Next')}
              </TourAction>
            )}
          </ButtonBar>
        }
        className={containerClassName}
        position={position}
        offset={offset}
      >
        <ScrollToGuide>{children}</ScrollToGuide>
      </TourGuide>
    );
  }
}

/**
 * Wraps the GuideAnchor so we don't have to render it if it's disabled
 * Using a class so we automatically have children as a typed prop
 */
type WrapperProps = Props & {
  children?: React.ReactNode;
  disabled?: boolean;
};

/**
 * A GuideAnchor puts an informative hovercard around an element. Guide anchors
 * register with the GuideStore, which uses registrations from one or more
 * anchors on the page to determine which guides can be shown on the page.
 */
function GuideAnchor({disabled, children, ...rest}: WrapperProps) {
  if (disabled) {
    return <Fragment>{children}</Fragment>;
  }
  return <BaseGuideAnchor {...rest}>{children}</BaseGuideAnchor>;
}

const GuideAnchorWrapper = styled('span')`
  display: inline-block;
  width: 100%;
`;

export default GuideAnchor;
