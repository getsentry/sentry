import React, {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {getCurrentHub, Replay} from '@sentry/react';
import classNames from 'classnames';

import useKeyPress from 'sentry/utils/useKeyPress';

import {FeedbackForm} from './feedbackForm';
import {FeedbackSuccessMessage} from './feedbackSuccessMessage';
import {sendFeedbackRequest} from './sendFeedbackRequest';
import {useFocusTrap} from './useFocusTrap';

interface RenderFunctionProps {
  /**
   * Is the modal open/visible
   */
  open: boolean;

  /**
   * Shows the feedback modal
   */
  showModal: () => void;
}
type FeedbackRenderFunction = (
  renderFunctionProps: RenderFunctionProps
) => React.ReactNode;

interface FeedbackModalProps {
  children: FeedbackRenderFunction;
  title: string;
  className?: string;
  descriptionPlaceholder?: string;
  sendButtonText?: string;
  type?: string;
  widgetTheme?: 'dark' | 'light';
}

interface FeedbackFormData {
  comment: string;
  email: string;
  name: string;
}

async function sendFeedback(
  data: FeedbackFormData,
  pageUrl: string,
  replayId?: string,
  type?: string
): Promise<Response | null> {
  const feedback = {
    message: data.comment,
    email: data.email,
    name: data.name,
    replay_id: replayId,
    url: pageUrl,
  };
  const tags = type ? {feedbackType: type} : null;
  return await sendFeedbackRequest({feedback, tags});
}

function stopPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

/**
 * Feedback widget's modal container
 *
 * XXX: This is only temporary as we move this to SDK
 */
export function FeedbackModal({
  className,
  descriptionPlaceholder = "What's the bug? What did you expect?",
  sendButtonText = 'Send Bug Report',
  widgetTheme = 'light',
  title,
  type,
  children,
}: FeedbackModalProps) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const escapePressed = useKeyPress('Escape');
  const isDarkTheme = widgetTheme === 'dark';

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = (data: FeedbackFormData) => {
    const replay = getCurrentHub()?.getClient()?.getIntegration(Replay);

    // Prepare session replay
    replay?.flush();
    const replayId = replay?.getReplayId();

    const pageUrl = document.location.href;

    sendFeedback(data, pageUrl, replayId, type).then(response => {
      if (response) {
        setOpen(false);
        setShowSuccessMessage(true);
        setError('');
      } else {
        setError('There was an error submitting feedback, please wait and try again.');
      }
    });
  };

  const showModal = () => {
    setOpen(true);
  };

  useEffect(() => {
    if (!showSuccessMessage) {
      return () => {};
    }
    const timeout = setTimeout(() => {
      setShowSuccessMessage(false);
    }, 6000);
    return () => {
      clearTimeout(timeout);
    };
  }, [showSuccessMessage]);

  useEffect(() => {
    if (escapePressed) {
      setOpen(false);
    }
  }, [escapePressed]);

  useFocusTrap(dialogRef, open);

  return (
    <Fragment>
      <Dialog
        id="feedbackModal"
        className={classNames(isDarkTheme ? '__sntry_fdbk_dark' : '', className)}
        open={open}
        ref={dialogRef}
        onClick={handleClose}
      >
        <Content onClick={stopPropagation}>
          <Header>{title}</Header>
          {errorMessage ? <Error>{errorMessage}</Error> : null}
          {open && (
            <FeedbackForm
              descriptionPlaceholder={descriptionPlaceholder}
              sendButtonText={sendButtonText}
              onSubmit={handleSubmit}
              onClose={handleClose}
            />
          )}
        </Content>
      </Dialog>
      <FeedbackSuccessMessage show={showSuccessMessage} />
      {children({open, showModal})}
    </Fragment>
  );
}

const Dialog = styled('dialog')`
  --sentry-feedback-bg-color: #fff;
  --sentry-feedback-bg-hover-color: #f0f0f0;
  --sentry-feedback-fg-color: #000;
  --sentry-feedback-border: 1.5px solid rgba(41, 35, 47, 0.13);
  --sentry-feedback-box-shadow: 0px 4px 24px 0px rgba(43, 34, 51, 0.12);

  &.__sntry_fdbk_dark {
    --sentry-feedback-bg-color: #29232f;
    --sentry-feedback-bg-hover-color: #3a3540;
    --sentry-feedback-fg-color: #ebe6ef;
    --sentry-feedback-border: 1.5px solid rgba(235, 230, 239, 0.15);
    --sentry-feedback-box-shadow: 0px 4px 24px 0px rgba(43, 34, 51, 0.12);
  }

  background-color: rgba(0, 0, 0, 0.05);
  border: none;
  position: fixed;
  inset: 0;
  z-index: 10000;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  transition: opacity 0.2s ease-in-out;
  &:not([open]) {
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }
`;

const Content = styled('div')`
  position: fixed;
  right: 1rem;
  bottom: 1rem;

  border: var(--sentry-feedback-border);
  padding: 24px;
  border-radius: 20px;
  background-color: var(--sentry-feedback-bg-color);
  color: var(--sentry-feedback-fg-color);

  width: 320px;
  max-width: 100%;
  max-height: calc(100% - 2rem);
  display: flex;
  flex-direction: column;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 4px 16px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease-in-out;
  transform: translate(0, 0) scale(1);
  dialog:not([open]) & {
    transform: translate(0, -16px) scale(0.98);
  }
`;

const Header = styled('h2')`
  font-size: 20px;
  font-weight: 600;
  padding: 0;
  margin: 0;
  margin-bottom: 16px;
`;

const Error = styled('div')`
  color: ${p => p.theme.error};
  margin-bottom: 16px;
`;
