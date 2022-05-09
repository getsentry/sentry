import {InjectedRouter} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import GlobalModal from 'sentry/components/globalModal';
import {RouteContext} from 'sentry/views/routeContext';

function TestComponent({router}: {router: InjectedRouter}) {
  return (
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {},
        routes: [],
      }}
    >
      <FeatureFeedback
        featureName="test"
        feedbackTypes={[
          "I don't like this feature",
          'I like this feature',
          'Other reason',
        ]}
      />
      <GlobalModal />
    </RouteContext.Provider>
  );
}

describe('FeatureFeedback', function () {
  const {router} = initializeOrg();

  beforeAll(async function () {
    // transpile the modal upfront so the test runs fast
    await import('sentry/components/featureFeedback/feedbackModal');
  });

  it('shows the modal on click', async function () {
    render(<TestComponent router={router} />);

    expect(screen.getByText('Give Feedback')).toBeInTheDocument();

    userEvent.click(screen.getByText('Give Feedback'));

    expect(
      await screen.findByRole('heading', {name: 'Submit Feedback'})
    ).toBeInTheDocument();
  });

  it('submits modal on click', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');

    render(<TestComponent router={router} />);

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

  it('Close modal on click', async function () {
    render(<TestComponent router={router} />);
    userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {name: 'Submit Feedback'})
      ).not.toBeInTheDocument();
    });
  });
});
