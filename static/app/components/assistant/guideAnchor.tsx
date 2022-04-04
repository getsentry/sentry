import {Fragment, useEffect, useRef} from 'react';
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
import Button from 'sentry/components/button';
import {Body as HovercardBody, Hovercard} from 'sentry/components/hovercard';
import {t, tct} from 'sentry/locale';
import GuideStore from 'sentry/stores/guideStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

type Props = React.PropsWithChildren<{
  /**
   * Hovercard renders the container
   */
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
}>;

function BaseGuideAnchor({
  target,
  onFinish,
  children,
  position,
  offset,
  containerClassName,
  to,
}: Props) {
  const guideContainerRef = useRef<HTMLSpanElement>(null);
  const {orgId, forceHide, currentGuide, currentStep} = useLegacyStore(GuideStore);

  const isActive =
    forceHide !== true && currentGuide?.steps[currentStep]?.target === (target ?? false);

  // Register the anchor in the store
  useEffect(() => {
    if (!target) {
      return () => {};
    }

    registerAnchor(target);
    return () => void unregisterAnchor(target);
  }, [target]);

  // Scroll to the guide on activation
  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (guideContainerRef.current === null) {
      return;
    }

    try {
      const {top} = guideContainerRef.current.getBoundingClientRect();
      const scrollTop = window.pageYOffset;
      const centerElement = top + scrollTop - window.innerHeight / 2;
      window.scrollTo({top: centerElement});
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [isActive]);

  // Terminology:
  //
  // - A guide can be FINISHED by clicking one of the buttons in the last step
  // - A guide can be DISMISSED by x-ing out of it at any step except the last
  //   (where there is no x)
  // - In both cases we consider it CLOSED

  function handleFinish(e: React.MouseEvent) {
    e.stopPropagation();
    onFinish?.();
    if (currentGuide) {
      recordFinish(currentGuide.guide, orgId);
    }
    closeGuide();
  }

  function handleNextStep(e: React.MouseEvent) {
    e.stopPropagation();
    nextStep();
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    if (currentGuide) {
      dismissGuide(currentGuide.guide, currentStep, orgId);
    }
  }

  if (!isActive || !currentGuide) {
    return <Fragment>{children}</Fragment>;
  }

  const totalStepCount = currentGuide.steps.length;
  const currentStepCount = currentStep + 1;
  const activeGuide = currentGuide.steps[currentStep];
  const lastStep = currentStepCount === totalStepCount;
  const hasManySteps = totalStepCount > 1;

  // to clear `#assistant` from the url
  const href = window.location.hash === '#assistant' ? '#' : '';

  const dismissButton = (
    <DismissButton
      size="small"
      translucentBorder
      href={href}
      onClick={handleDismiss}
      priority="link"
    >
      {activeGuide.dismissText || t('Dismiss')}
    </DismissButton>
  );

  const hovercardBody = (
    <GuideContainer data-test-id="guide-container">
      <GuideContent>
        {activeGuide.title && <GuideTitle>{activeGuide.title}</GuideTitle>}
        <GuideDescription>{activeGuide.description}</GuideDescription>
      </GuideContent>
      <GuideAction>
        <div>
          {lastStep ? (
            <Fragment>
              <StyledButton size="small" translucentBorder to={to} onClick={handleFinish}>
                {activeGuide.nextText ||
                  (hasManySteps ? t('Enough Already') : t('Got It'))}
              </StyledButton>
              {activeGuide.hasNextGuide && dismissButton}
            </Fragment>
          ) : (
            <Fragment>
              <StyledButton
                size="small"
                translucentBorder
                onClick={handleNextStep}
                to={to}
              >
                {activeGuide.nextText || t('Next')}
              </StyledButton>
              {!activeGuide.cantDismiss && dismissButton}
            </Fragment>
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

  return (
    <StyledHovercard
      show
      body={hovercardBody}
      tipColor={theme.purple300}
      position={position}
      offset={offset}
      containerClassName={containerClassName}
    >
      <span ref={guideContainerRef}>{children}</span>
    </StyledHovercard>
  );
}

/**
 * Wraps the GuideAnchor so we don't have to render it if it's disabled
 * Using a class so we automatically have children as a typed prop
 */
type GuideAnchorProps = React.PropsWithChildren<{disabled?: boolean} & Props>;

/**
 * A GuideAnchor puts an informative hovercard around an element. Guide anchors
 * register with the GuideStore, which uses registrations from one or more
 * anchors on the page to determine which guides can be shown on the page.
 */
function GuideAnchor({disabled, children, ...rest}: GuideAnchorProps) {
  return (
    <Fragment>
      {disabled ? children : <BaseGuideAnchor {...rest}>{children}</BaseGuideAnchor>}
    </Fragment>
  );
}

export default GuideAnchor;

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
