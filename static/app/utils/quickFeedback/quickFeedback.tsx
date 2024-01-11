import {getCurrentHub} from '@sentry/react';

import {openModal} from 'sentry/actionCreators/modal';
import localStorage from 'sentry/utils/localStorage';

interface PromptRequest {
  createTime: number;
  prompt: string;
  showOnUrl: string;
}

const localStorageKey = 'quick-feedback';

const QuickFeedback = {
  setPrompt: (prompt: string, showOnUrl: string) => {
    const value: PromptRequest = {
      createTime: Date.now(),
      prompt,
      showOnUrl,
    };
    localStorage.setItem(localStorageKey, JSON.stringify(value));
  },

  getPrompt: (): undefined | PromptRequest => {
    return JSON.parse(localStorage.getItme(localStorageKey) ?? '');
  },

  clear: () => {
    localStorage.removeItem(localStorageKey);
  },

  tryPrompt: async () => {
    const request = QuickFeedback.getPrompt();
    if (!request) {
      return;
    }
    if (request.createTime < Date.now() - 1000 * 60 * 10) {
      // after 10mins it's going to expire
      return;
    }
    if (request.showOnUrl !== '/issues/') {
      return;
    }

    const {Feedback} = await import('@sentry/react');
    const client = getCurrentHub().getClient();
    const feedback = client?.getIntegration(Feedback);

    // client.sen
    // feedback;
    if (!feedback) {
      return;
    }

    const mod = await import(
      'sentry/components/modals/quickFeedbackModal/quickFeedbackModal'
    );
    const {default: Modal, modalCss} = mod;

    const onSubmit = (message: string) => {
      console.log('they said', {message});
      // sendFeedback({message});
    };
    openModal(deps => <Modal {...deps} prompt={request.prompt} onSubmit={onSubmit} />, {
      modalCss,
    });

    return;
  },
};

export default QuickFeedback;
