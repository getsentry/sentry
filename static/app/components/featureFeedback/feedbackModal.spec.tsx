import * as Sentry from '@sentry/react';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import {FeedbackModal} from './feedbackModal';

describe('FeatureFeedback', () => {
  describe('default', () => {
    it('submits modal on click', async () => {
      jest.spyOn(toast, 'success');

      const feedbackClient = new Sentry.BrowserClient({
        transport: Sentry.makeFetchTransport,
        stackParser: Sentry.defaultStackParser,
        integrations: Sentry.getDefaultIntegrations({}),
      });

      renderGlobalModal();

      act(() =>
        openModal(modalProps => <FeedbackModal {...modalProps} featureName="test" />)
      );

      // Form fields
      expect(screen.getByText('Select type of feedback')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What did you expect?')).toBeInTheDocument();

      // Form actions
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Submit'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      // User enters additional feedback message
      await userEvent.click(screen.getByPlaceholderText(/what did you expect/i));
      await userEvent.paste('this is a feedback message');
      await userEvent.keyboard('{enter}');

      // Submit button is still disabled
      expect(screen.getByRole('button', {name: 'Submit'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText("I don't like this feature")).toBeInTheDocument();
      expect(screen.getByText('Other reason')).toBeInTheDocument();
      expect(screen.getByText('I like this feature')).toBeInTheDocument();

      // Select feedback type
      await userEvent.click(screen.getByText('I like this feature'));

      // Submit button is now enabled because the required field was selected
      expect(screen.getByRole('button', {name: 'Submit'})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

      await waitFor(() =>
        expect(feedbackClient.captureEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            request: {url: 'http://localhost/'},
            message:
              'test feedback by foo@example.com - I like this feature - this is a feedback message\n',
            contexts: {feedback: {additionalInfo: 'this is a feedback message\n'}},
          })
        )
      );

      expect(toast.success).toHaveBeenCalledWith(
        'Thanks for taking the time to provide us feedback!'
      );
    });

    it('renders provided feedbackTypes', async () => {
      renderGlobalModal();

      act(() =>
        openModal(modalProps => (
          <FeedbackModal
            {...modalProps}
            featureName="test"
            feedbackTypes={['Custom feedback type A', 'Custom feedback type B']}
          />
        ))
      );

      await userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText('Custom feedback type A')).toBeInTheDocument();
      expect(screen.getByText('Custom feedback type B')).toBeInTheDocument();

      // Close modal
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    });

    it('renders an arbitrary secondary action', async () => {
      renderGlobalModal();

      act(() =>
        openModal(modalProps => (
          <FeedbackModal
            {...modalProps}
            featureName="test"
            secondaryAction={<a href="#">Test Secondary Action Link</a>}
          />
        ))
      );

      await userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText('Test Secondary Action Link')).toBeInTheDocument();

      // Close modal
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    });
  });
});
