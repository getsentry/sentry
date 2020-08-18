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
  image?: React.ReactNode;
  body: React.ReactNode;
  actions: React.ReactNode;
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
   * Triggered when the tour is closed by completion or x
   */
  onCloseModal?: (currentIndex: number, durationOpen: number) => void;
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
  state: ContentsState = {
    openedAt: Date.now(),
    current: 0,
  };

  handleAdvance = () => {
    const {onAdvance} = this.props;
    this.setState({current: this.state.current + 1}, () => {
      const duration = Date.now() - this.state.openedAt;
      callIfFunction(onAdvance, this.state.current, duration);
    });
  };

  handleClose = () => {
    const {closeModal, onCloseModal} = this.props;

    const duration = Date.now() - this.state.openedAt;
    callIfFunction(onCloseModal, this.state.current, duration);

    // Call the modal close.
    closeModal();
  };

  render() {
    const {Body, steps} = this.props;
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
              <Button priority="primary" onClick={this.handleAdvance}>
                {t('Next')}
              </Button>
            )}
            {!hasNext && <Button onClick={this.handleClose}>{t('All Done')}</Button>}
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
  children: (childProps: ChildProps) => React.ReactNode;
} & Pick<ContentsProps, 'steps' | 'onCloseModal' | 'onAdvance'>;

function FeatureTourModal(props: Props) {
  const handleShow = () => {
    const modalProps = omit(props, ['children']);
    openModal(deps => <ModalContents {...deps} {...modalProps} />);
  };
  return props.children({handleShow});
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
