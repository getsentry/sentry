import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {css} from 'emotion';
import $ from 'jquery';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
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
import {CloseIcon} from 'app/components/assistant/styles';

// A GuideAnchor puts an informative hovercard around an element.
// Guide anchors register with the GuideStore, which uses registrations
// from one or more anchors on the page to determine which guides can
// be shown on the page.
const GuideAnchor = createReactClass({
  propTypes: {
    target: PropTypes.string.isRequired,
    position: PropTypes.string,
  },

  mixins: [Reflux.listenTo(GuideStore, 'onGuideStateChange')],

  getInitialState() {
    return {
      active: false,
    };
  },

  componentDidMount() {
    registerAnchor(this);
  },

  componentDidUpdate(prevProps, prevState) {
    if (this.containerElement && !prevState.active && this.state.active) {
      const windowHeight = $(window).height();
      $('html,body').animate({
        scrollTop: $(this.containerElement).offset().top - windowHeight / 2,
      });
    }
  },

  componentWillUnmount() {
    unregisterAnchor(this);
  },

  onGuideStateChange(data) {
    const active =
      data.currentGuide &&
      data.currentGuide.steps[data.currentStep].target === this.props.target;
    this.setState({
      active,
      guide: data.currentGuide,
      step: data.currentStep,
      org: data.org,
      messageVariables: {
        orgSlug: data.org && data.org.slug,
        projectSlug: data.project && data.project.slug,
      },
    });
  },

  interpolate(template, variables) {
    const regex = /\${([^{]+)}/g;
    return template.replace(regex, (match, g1) => {
      return variables[g1.trim()];
    });
  },

  /* Terminology:
   - A guide can be FINISHED by clicking one of the buttons in the last step.
   - A guide can be DISMISSED by x-ing out of it at any step except the last (where there is no x).
   - In both cases we consider it CLOSED.
  */
  handleFinish(e) {
    e.stopPropagation();
    const {guide, org} = this.state;
    recordFinish(guide.id, org);
    closeGuide();
  },

  handleNextStep(e) {
    e.stopPropagation();
    nextStep();
  },

  handleDismiss(e) {
    e.stopPropagation();
    const {guide, step, org} = this.state;
    dismissGuide(guide.id, step, org);
  },

  render() {
    const {active, guide, step, messageVariables} = this.state;
    if (!active) {
      return this.props.children ? this.props.children : null;
    }

    const body = (
      <GuideContainer>
        <GuideInputRow>
          <StyledTitle>{guide.steps[step].title}</StyledTitle>
          {step < guide.steps.length - 1 && (
            <CloseLink onClick={this.handleDismiss} href="#" data-test-id="close-button">
              <CloseIcon />
            </CloseLink>
          )}
        </GuideInputRow>
        <StyledContent>
          <div
            dangerouslySetInnerHTML={{
              __html: this.interpolate(guide.steps[step].message, messageVariables),
            }}
          />
          <div css={{marginTop: '1em'}}>
            <div>
              {step < guide.steps.length - 1 ? (
                <Button priority="success" size="small" onClick={this.handleNextStep}>
                  {t('Next')} &rarr;
                </Button>
              ) : (
                <Button priority="success" size="small" onClick={this.handleFinish}>
                  {t(guide.steps.length === 1 ? 'Got It' : 'Done')}
                </Button>
              )}
            </div>
          </div>
        </StyledContent>
      </GuideContainer>
    );

    return (
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
  font-size: 1.3em;
  flex-grow: 1;
`;

const StyledContent = styled('div')`
  margin-top: ${space(1)};
  line-height: 1.5;

  a {
    color: ${p => p.theme.greenLight};
  }
`;

export default GuideAnchor;
