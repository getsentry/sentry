import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export type TourStep = {
  body: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
  image?: React.ReactNode;
};

type ChildProps = {
  showModal: () => void;
};

type Props = {
  children: (props: ChildProps) => React.ReactNode;
  /**
   * Provide a URL for the done state to open in a new tab.
   */
  doneUrl: string;
  /**
   * The list of tour steps.
   * The FeatureTourModal will manage state on the active step.
   */
  steps: TourStep[];
  /**
   * Customize the text shown on the done button.
   */
  doneText?: string;
  /**
   * Triggered when the tour is advanced.
   */
  onAdvance?: (currentIndex: number, durationOpen: number) => void;
  /**
   * Triggered when the tour is closed by completion or IconClose
   */
  onCloseModal?: (currentIndex: number, durationOpen: number) => void;
};

type State = {
  /**
   * The last known step
   */
  current: number;

  /**
   * The timestamp when the modal was shown.
   * Used to calculate how long the modal was open
   */
  openedAt: number;
};

const defaultProps = {
  doneText: t('Done'),
};

/**
 * Provide a showModal action to the child function that lets
 * a tour be triggered.
 *
 * Once active this component will track when the tour was started and keep
 * a last known step state. Ideally the state would live entirely in this component.
 * However, once the modal has been opened state changes in this component don't
 * trigger re-renders in the modal contents. This requires a bit of duplicate state
 * to be managed around the current step.
 */
class FeatureTourModal extends Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    openedAt: 0,
    current: 0,
  };

  // Record the step change and call the callback this component was given.
  handleAdvance = (current: number, duration: number) => {
    this.setState({current});
    this.props.onAdvance?.(current, duration);
  };

  handleShow = () => {
    this.setState({openedAt: Date.now()}, () => {
      const modalProps = {
        steps: this.props.steps,
        onAdvance: this.handleAdvance,
        openedAt: this.state.openedAt,
        doneText: this.props.doneText,
        doneUrl: this.props.doneUrl,
      };
      openModal(deps => <ModalContents {...deps} {...modalProps} />, {
        onClose: this.handleClose,
      });
    });
  };

  handleClose = () => {
    // The bootstrap modal and modal store both call this callback.
    // We use the state flag to deduplicate actions to upstream components.
    if (this.state.openedAt === 0) {
      return;
    }
    const {onCloseModal} = this.props;

    const duration = Date.now() - this.state.openedAt;
    onCloseModal?.(this.state.current, duration);

    // Reset the state now that the modal is closed, used to deduplicate close actions.
    this.setState({openedAt: 0, current: 0});
  };

  render() {
    const {children} = this.props;
    return <Fragment>{children({showModal: this.handleShow})}</Fragment>;
  }
}

export default FeatureTourModal;

type ContentsProps = ModalRenderProps &
  Pick<Props, 'steps' | 'doneText' | 'doneUrl' | 'onAdvance'> &
  Pick<State, 'openedAt'>;

type ContentsState = {
  current: number;
  openedAt: number;
};

class ModalContents extends Component<ContentsProps, ContentsState> {
  static defaultProps = defaultProps;

  state: ContentsState = {
    current: 0,
    openedAt: Date.now(),
  };

  handleAdvance = () => {
    const {onAdvance, openedAt} = this.props;
    this.setState(
      prevState => ({current: prevState.current + 1}),
      () => {
        const duration = Date.now() - openedAt;
        onAdvance?.(this.state.current, duration);
      }
    );
  };

  render() {
    const {Body, steps, doneText, doneUrl, closeModal} = this.props;
    const {current} = this.state;

    const step = steps[current] !== undefined ? steps[current] : steps[steps.length - 1]!;
    const hasNext = steps[current + 1] !== undefined;

    return (
      <Body data-test-id="feature-tour">
        <CloseButton
          borderless
          size="zero"
          onClick={closeModal}
          icon={<IconClose />}
          aria-label={t('Close tour')}
        />
        <TourContent>
          {step.image}
          <TourHeader>{step.title}</TourHeader>
          {step.body}
          <TourButtonBar gap={1}>
            {step.actions && step.actions}
            {hasNext && (
              <Button priority="primary" onClick={this.handleAdvance}>
                {t('Next')}
              </Button>
            )}
            {!hasNext && (
              <LinkButton
                external
                href={doneUrl}
                onClick={closeModal}
                priority="primary"
                aria-label={t('Complete tour')}
              >
                {doneText}
              </LinkButton>
            )}
          </TourButtonBar>
          <StepCounter>{t('%s of %s', current + 1, steps.length)}</StepCounter>
        </TourContent>
      </Body>
    );
  }
}

const CloseButton = styled(Button)`
  position: absolute;
  top: -${space(2)};
  right: -${space(1)};
`;

const TourContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: ${space(3)} ${space(4)} ${space(1)} ${space(4)};
`;

const TourHeader = styled('h4')`
  margin-bottom: ${space(1)};
`;

const TourButtonBar = styled(ButtonBar)`
  margin-bottom: ${space(3)};
`;

const StepCounter = styled('div')`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.gray300};
`;

// Styled components that can be used to build tour content.
export const TourText = styled('p')`
  text-align: center;
  margin-bottom: ${space(4)};
`;

export const TourImage = styled('img')`
  height: 200px;
  margin-bottom: ${space(4)};

  /** override styles in less files */
  max-width: 380px !important;
  box-shadow: none !important;
  border: 0 !important;
  border-radius: 0 !important;
`;
