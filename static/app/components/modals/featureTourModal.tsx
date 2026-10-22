import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {IconClose} from '@sentry/icons/close';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid, Stack, type GridProps} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';

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
export function FeatureTourModal({
  children,
  steps,
  doneUrl,
  doneText = t('Done'),
  onAdvance,
  onCloseModal,
}: Props) {
  // These values are only read inside callbacks, never during render,
  // so refs avoid unnecessary re-renders.
  const openedAtRef = useRef<number>(0);
  const currentRef = useRef<number>(0);

  const handleAdvance = useCallback(
    (current: number, duration: number) => {
      currentRef.current = current;
      onAdvance?.(current, duration);
    },
    [onAdvance]
  );

  const handleClose = useCallback(() => {
    // The bootstrap modal and modal store both call this callback.
    // We use the ref flag to deduplicate actions to upstream components.
    if (openedAtRef.current === 0) {
      return;
    }
    const duration = Date.now() - openedAtRef.current;
    onCloseModal?.(currentRef.current, duration);

    // Reset now that the modal is closed, used to deduplicate close actions.
    openedAtRef.current = 0;
    currentRef.current = 0;
  }, [onCloseModal]);

  const handleShow = useCallback(() => {
    openedAtRef.current = Date.now();
    const modalProps = {
      steps,
      onAdvance: handleAdvance,
      openedAt: openedAtRef.current,
      doneText,
      doneUrl,
    };
    openModal(deps => <ModalContents {...deps} {...modalProps} />, {
      onClose: handleClose,
    });
  }, [steps, handleAdvance, doneText, doneUrl, handleClose]);

  // showModal only reads refs when the child invokes it from an event handler.
  // oxlint-disable-next-line react/refs
  return children({showModal: handleShow});
}

type ContentsProps = ModalRenderProps &
  Pick<Props, 'steps' | 'doneText' | 'doneUrl' | 'onAdvance'> & {
    openedAt: number;
  };

function ModalContents({
  Body,
  steps,
  doneText = t('Done'),
  doneUrl,
  closeModal,
  onAdvance,
  openedAt,
}: ContentsProps) {
  const [current, setCurrent] = useState(0);

  const handleAdvance = () => {
    const next = current + 1;
    setCurrent(next);
    onAdvance?.(next, Date.now() - openedAt);
  };

  const step = steps[current] === undefined ? steps[steps.length - 1]! : steps[current];
  const hasNext = steps[current + 1] !== undefined;

  return (
    <Body data-test-id="feature-tour">
      <CloseButton
        variant="transparent"
        size="zero"
        onClick={closeModal}
        icon={<IconClose />}
        aria-label={t('Close tour')}
      />
      <Stack align="center" margin="2xl 3xl md 3xl">
        {step.image}
        <TourHeader>{step.title}</TourHeader>
        {step.body}
        <TourButtonBar>
          {step.actions && step.actions}
          {hasNext && (
            <Button variant="primary" onClick={handleAdvance}>
              {t('Next')}
            </Button>
          )}
          {!hasNext && (
            <LinkButton
              external
              href={doneUrl}
              onClick={closeModal}
              variant="primary"
              aria-label={t('Complete tour')}
            >
              {doneText}
            </LinkButton>
          )}
        </TourButtonBar>
        <StepCounter>{t('%s of %s', current + 1, steps.length)}</StepCounter>
      </Stack>
    </Body>
  );
}

const CloseButton = styled(Button)`
  position: absolute;
  top: -${p => p.theme.space.xl};
  right: -${p => p.theme.space.md};
`;

const TourHeader = styled('h4')`
  margin-bottom: ${p => p.theme.space.md};
`;

const TourButtonBar = styled((props: GridProps) => (
  <Grid flow="column" align="center" gap="md" {...props} />
))`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const StepCounter = styled('div')`
  text-transform: uppercase;
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
`;

// Styled components that can be used to build tour content.
export const TourText = styled('p')`
  text-align: center;
  margin-bottom: ${p => p.theme.space['3xl']};
`;

export const TourImage = styled('img')`
  height: 200px;
  margin-bottom: ${p => p.theme.space['3xl']};

  /** override styles in less files */
  max-width: 380px !important;
  box-shadow: none !important;
  border: 0 !important;
  border-radius: 0 !important;
`;
