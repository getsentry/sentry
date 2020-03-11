import {ClassNames} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import * as Sentry from '@sentry/browser';

import theme from 'app/utils/theme';
import {
  registerAnchor,
  unregisterAnchor,
  nextStep,
  closeGuide,
  recordFinish,
  dismissGuide,
} from 'app/actionCreators/guides';
import GuideStore from 'app/stores/guideStore';
import Hovercard from 'app/components/hovercard';
import Button from 'app/components/button';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {Guide} from 'app/components/assistant/types';
import {CloseIcon} from 'app/components/assistant/styles';

type Props = {
  target: string;
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
    target: PropTypes.string.isRequired,
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
    const {currentGuide, org} = this.state;
    recordFinish(currentGuide.guide, org);
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

  render() {
    const {active, currentGuide, step} = this.state;
    if (!active) {
      return this.props.children ? this.props.children : null;
    }

    const body = (
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

    return (
      <ClassNames>
        {({css}) => (
          <Hovercard
            show
            body={body}
            bodyClassName={css`
              background-color: ${theme.greenDark};
              margin: -1px;
            `}
            tipColor={theme.greenDark}
            position={this.props.position}
          >
            <span ref={el => (this.containerElement = el)}>{this.props.children}</span>
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

export default GuideAnchor;
