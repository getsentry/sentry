import {Fragment} from 'react';
import {
  BrowserClient,
  defaultIntegrations,
  defaultStackParser,
  makeFetchTransport,
} from '@sentry/react';
import * as Sentry from '@sentry/react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {FeedbackModal} from 'sentry/components/featureFeedback/feedbackModal';
import TextField from 'sentry/components/forms/fields/textField';
import {RouteContext} from 'sentry/views/routeContext';

function ComponentProviders({children}: {children: React.ReactNode}) {
  const {router} = initializeOrg();

  return (
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {},
        routes: [],
      }}
    >
      {children}
    </RouteContext.Provider>
  );
}

describe('FeatureFeedback', function () {
  describe('default', function () {
    it('submits modal on click', async function () {
      jest.spyOn(indicators, 'addSuccessMessage');

      const feedbackClient = new Sentry.BrowserClient({
        transport: makeFetchTransport,
        stackParser: defaultStackParser,
        integrations: defaultIntegrations,
      });

      renderGlobalModal();

      act(() =>
        openModal(modalProps => (
          <ComponentProviders>
            <FeedbackModal {...modalProps} featureName="test" />
          </ComponentProviders>
        ))
      );

      // Form fields
      expect(screen.getByText('Select type of feedback')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What did you expect?')).toBeInTheDocument();

      // Form actions
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeDisabled();

      // User enters additional feedback message
      await userEvent.click(screen.getByPlaceholderText(/what did you expect/i));
      await userEvent.paste('this is a feedback message');
      await userEvent.keyboard('{enter}');

      // Submit button is still disabled
      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeDisabled();

      await userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText("I don't like this feature")).toBeInTheDocument();
      expect(screen.getByText('Other reason')).toBeInTheDocument();
      expect(screen.getByText('I like this feature')).toBeInTheDocument();

      // Select feedback type
      await userEvent.click(screen.getByText('I like this feature'));

      // Submit button is now enabled because the required field was selected
      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeEnabled();

      await userEvent.click(screen.getByRole('button', {name: 'Submit Feedback'}));

      await waitFor(() =>
        expect(feedbackClient.captureEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            request: {
              url: 'http://localhost/',
            },
          })
        )
      );

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Thanks for taking the time to provide us feedback!'
      );
    });

    it('renders provided feedbackTypes', async function () {
      renderGlobalModal();

      act(() =>
        openModal(modalProps => (
          <ComponentProviders>
            <FeedbackModal
              {...modalProps}
              featureName="test"
              feedbackTypes={['Custom feedback type A', 'Custom feedback type B']}
            />
          </ComponentProviders>
        ))
      );

      await userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText('Custom feedback type A')).toBeInTheDocument();
      expect(screen.getByText('Custom feedback type B')).toBeInTheDocument();

      // Close modal
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    });

    it('renders an arbitrary secondary action', async function () {
      renderGlobalModal();

      act(() =>
        openModal(modalProps => (
          <ComponentProviders>
            <FeedbackModal
              {...modalProps}
              featureName="test"
              secondaryAction={<a href="#">Test Secondary Action Link</a>}
            />
          </ComponentProviders>
        ))
      );

      await userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText('Test Secondary Action Link')).toBeInTheDocument();

      // Close modal
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    });
  });

  describe('custom', function () {
    it('renders custom feedback form', async function () {
      jest.spyOn(indicators, 'addSuccessMessage');

      // Mock implementation of the Sentry Browser SDK
      BrowserClient.prototype.captureEvent = jest.fn();

      renderGlobalModal();

      act(() =>
        openModal(modalProps => (
          <ComponentProviders>
            <FeedbackModal
              {...modalProps}
              featureName="test"
              initialData={{step: 0, name: null, surname: null}}
            >
              {({Header, Body, Footer, state, onFieldChange}) => {
                if (state.step === 0) {
                  return (
                    <Fragment>
                      <Header>First Step</Header>
                      <Body>
                        <TextField
                          label="Name"
                          value={state.name}
                          name="name"
                          onChange={value => onFieldChange('name', value)}
                        />
                      </Body>
                      <Footer onNext={() => onFieldChange('step', 1)} />
                    </Fragment>
                  );
                }

                return (
                  <Fragment>
                    <Header>Last Step</Header>
                    <Body>
                      <TextField
                        label="Surname"
                        value={state.surname}
                        name="surname"
                        onChange={value => onFieldChange('surname', value)}
                      />
                    </Body>
                    <Footer
                      onBack={() => onFieldChange('step', 0)}
                      primaryDisabledReason={
                        !state.surname ? 'Please answer at least one question' : undefined
                      }
                      submitEventData={{message: 'Feedback: test'}}
                    />
                  </Fragment>
                );
              }}
            </FeedbackModal>
          </ComponentProviders>
        ))
      );

      // Does not render the default form
      expect(screen.queryByText('Select type of feedback')).not.toBeInTheDocument();

      // Custom form
      expect(screen.getByRole('heading', {name: 'First Step'})).toBeInTheDocument();

      // Change form field
      expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue('');
      await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'new value');
      expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue('new value');

      // Go to next step
      await userEvent.click(screen.getByRole('button', {name: 'Next'}));

      // Next step is rendered
      expect(screen.getByRole('heading', {name: 'Last Step'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Back'})).toBeInTheDocument();

      // Go to previous step
      await userEvent.click(screen.getByRole('button', {name: 'Back'}));

      // Previous step is rendered
      expect(screen.getByRole('heading', {name: 'First Step'})).toBeInTheDocument();

      // Go to next step
      await userEvent.click(screen.getByRole('button', {name: 'Next'}));

      // Next step is rendered
      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeDisabled();

      // Change form field
      expect(screen.getByRole('textbox', {name: 'Surname'})).toHaveValue('');
      await userEvent.type(screen.getByRole('textbox', {name: 'Surname'}), 'new value');
      expect(screen.getByRole('textbox', {name: 'Surname'})).toHaveValue('new value');

      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeEnabled();

      await userEvent.click(screen.getByRole('button', {name: 'Submit Feedback'}));

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Thanks for taking the time to provide us feedback!'
      );
    });
  });
});
