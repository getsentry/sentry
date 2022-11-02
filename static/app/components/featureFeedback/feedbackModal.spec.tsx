import {Fragment} from 'react';
import {BrowserClient} from '@sentry/react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {FeedbackModal} from 'sentry/components/featureFeedback/feedbackModal';
import {RouteContext} from 'sentry/views/routeContext';

import {TextField} from '../forms';

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
    it('submits modal on click', function () {
      jest.spyOn(indicators, 'addSuccessMessage');

      renderGlobalModal();

      openModal(modalProps => (
        <ComponentProviders>
          <FeedbackModal {...modalProps} featureName="test" />
        </ComponentProviders>
      ));

      // Form fields
      expect(screen.getByText('Select type of feedback')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What did you expect?')).toBeInTheDocument();

      // Form actions
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeDisabled();

      // User enters additional feedback message
      userEvent.paste(
        screen.getByPlaceholderText('What did you expect?'),
        'this is a feedback message'
      );
      userEvent.keyboard('{enter}');

      // Submit button is still disabled
      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeDisabled();

      userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText("I don't like this feature")).toBeInTheDocument();
      expect(screen.getByText('Other reason')).toBeInTheDocument();
      expect(screen.getByText('I like this feature')).toBeInTheDocument();

      // Select feedback type
      userEvent.click(screen.getByText('I like this feature'));

      // Submit button is now enabled because the required field was selected
      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeEnabled();

      userEvent.click(screen.getByRole('button', {name: 'Submit Feedback'}));

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Thanks for taking the time to provide us feedback!'
      );
    });

    it('renders provided feedbackTypes', function () {
      renderGlobalModal();

      openModal(modalProps => (
        <ComponentProviders>
          <FeedbackModal
            {...modalProps}
            featureName="test"
            feedbackTypes={['Custom feedback type A', 'Custom feedback type B']}
          />
        </ComponentProviders>
      ));

      userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText('Custom feedback type A')).toBeInTheDocument();
      expect(screen.getByText('Custom feedback type B')).toBeInTheDocument();

      // Close modal
      userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    });

    it('renders an arbitrary secondary action', function () {
      renderGlobalModal();

      openModal(modalProps => (
        <ComponentProviders>
          <FeedbackModal
            {...modalProps}
            featureName="test"
            secondaryAction={<a href="#">Test Secondary Action Link</a>}
          />
        </ComponentProviders>
      ));

      userEvent.click(screen.getByText('Select type of feedback'));

      // Available feedback types
      expect(screen.getByText('Test Secondary Action Link')).toBeInTheDocument();

      // Close modal
      userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    });
  });

  describe('custom', function () {
    it('renders custom feedback form', function () {
      jest.spyOn(indicators, 'addSuccessMessage');

      // Mock implementation of the Sentry Browser SDK
      BrowserClient.prototype.captureEvent = jest.fn();

      renderGlobalModal();

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
      ));

      // Does not render the default form
      expect(screen.queryByText('Select type of feedback')).not.toBeInTheDocument();

      // Custom form
      expect(screen.getByRole('heading', {name: 'First Step'})).toBeInTheDocument();

      // Change form field
      expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue('');
      userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'new value');
      expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue('new value');

      // Go to next step
      userEvent.click(screen.getByRole('button', {name: 'Next'}));

      // Next step is rendered
      expect(screen.getByRole('heading', {name: 'Last Step'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Back'})).toBeInTheDocument();

      // Go to previous step
      userEvent.click(screen.getByRole('button', {name: 'Back'}));

      // Previous step is rendered
      expect(screen.getByRole('heading', {name: 'First Step'})).toBeInTheDocument();

      // Go to next step
      userEvent.click(screen.getByRole('button', {name: 'Next'}));

      // Next step is rendered
      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeDisabled();

      // Change form field
      expect(screen.getByRole('textbox', {name: 'Surname'})).toHaveValue('');
      userEvent.type(screen.getByRole('textbox', {name: 'Surname'}), 'new value');
      expect(screen.getByRole('textbox', {name: 'Surname'})).toHaveValue('new value');

      expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeEnabled();

      userEvent.click(screen.getByRole('button', {name: 'Submit Feedback'}));

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Thanks for taking the time to provide us feedback!'
      );
    });
  });
});
