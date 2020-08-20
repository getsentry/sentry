import React from 'react';
import omit from 'lodash/omit';
import styled from '@emotion/styled';

import {openModal, ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {IconClose} from 'app/icons';
import {callIfFunction} from 'app/utils/callIfFunction';
import space from 'app/styles/space';

type TourStep = {
  title: string;
  body: React.ReactNode;
  actions?: React.ReactElement;
  image?: React.ReactElement;
};

type ContentsProps = ModalRenderProps & {
  /**
   * The list of tour steps.
   * The FeatureTourModal will manage state on the active step.
   */
  steps: TourStep[];
  /**
   * Triggered when the tour is advanced.
   */
  onAdvance?: (currentIndex: number, durationOpen: number) => void;
  /**
   * Triggered when the tour is closed by completion or IconClose
   */
  onCloseModal?: (currentIndex: number, durationOpen: number) => void;
  /**
   * Customize the text shown on the done button.
   */
  doneText?: string;
  /**
   * Provide a URL for the done state to open in a new tab.
   */
  doneUrl?: string;
};

const defaultProps = {
  doneText: t('Done'),
};

type ContentsState = {
  /**
   * The current step offset to show
   */
  current: number;

  /**
   * The timestamp with ms the tour was opened,
   * used to track duration on each step.
   */
  openedAt: number;
};

class ModalContents extends React.Component<ContentsProps, ContentsState> {
  static defaultProps = defaultProps;

  state: ContentsState = {
    openedAt: Date.now(),
    current: 0,
  };

  handleAdvance = () => {
    const {onAdvance} = this.props;
    this.setState(
      prevState => ({current: prevState.current + 1}),
      () => {
        const duration = Date.now() - this.state.openedAt;
        callIfFunction(onAdvance, this.state.current, duration);
      }
    );
  };

  handleClose = () => {
    const {closeModal, onCloseModal} = this.props;

    const duration = Date.now() - this.state.openedAt;
    callIfFunction(onCloseModal, this.state.current, duration);

    // Call the modal close.
    closeModal();
  };

  render() {
    const {Body, steps, doneText, doneUrl} = this.props;
    const {current} = this.state;
    const step = steps[current] !== undefined ? steps[current] : steps[steps.length - 1];
    const hasNext = steps[current + 1] !== undefined;

    return (
      <Body>
        <CloseButton
          borderless
          size="zero"
          onClick={this.handleClose}
          icon={<IconClose />}
        />
        {step.image && <TourContent>{step.image}</TourContent>}
        <TourContent>
          <h3>{step.title}</h3>
          {step.body}
        </TourContent>
        <TourContent>
          <ButtonBar gap={1}>
            {step.actions && step.actions}
            {hasNext && (
              <Button
                data-test-id="next-step"
                priority="primary"
                onClick={this.handleAdvance}
              >
                {t('Next')}
              </Button>
            )}
            {!hasNext && (
              <Button
                external
                href={doneUrl}
                data-test-id="complete-tour"
                onClick={this.handleClose}
              >
                {doneText}
              </Button>
            )}
          </ButtonBar>
        </TourContent>
        <StepCounter>{t('%s of %s', current + 1, steps.length)}</StepCounter>
      </Body>
    );
  }
}

type ChildProps = {
  handleShow: () => void;
};

type Props = {
  children: (props: ChildProps) => React.ReactNode;
} & Pick<ContentsProps, 'steps' | 'onCloseModal' | 'onAdvance' | 'doneText' | 'doneUrl'>;

function FeatureTourModal(props: Props) {
  const handleShow = () => {
    const modalProps = omit(props, ['children']);
    openModal(deps => <ModalContents {...deps} {...modalProps} />);
  };
  return <React.Fragment>{props.children({handleShow})}</React.Fragment>;
}

export default FeatureTourModal;

const CloseButton = styled(Button)`
  position: absolute;
  top: -${space(2)};
  right: -${space(2)};
`;

const TourContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: ${space(2)};
`;

const StepCounter = styled(TourContent)`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray400};
  margin-bottom: 0;
`;

// Styled components that can be used to build tour content.
export const TourText = styled('p')`
  text-align: center;
  margin: 0 ${space(3)};
`;

export const TourImage = styled('img')`
  margin-top: ${space(4)};
  /** override styles in less files */
  box-shadow: none !important;
  border: 0 !important;
  border-radius: 0 !important;
`;
