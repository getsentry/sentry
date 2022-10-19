import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import GlobalModal from 'sentry/components/globalModal';
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
      <GlobalModal />
    </RouteContext.Provider>
  );
}

describe('FeatureFeedback', function () {
  it('shows the modal on click', async function () {
    render(
      <ComponentProviders>
        <FeatureFeedback featureName="test" />
      </ComponentProviders>
    );

    userEvent.click(screen.getByText('Give Feedback'));

    expect(await screen.findByText('Select type of feedback')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeInTheDocument();
  });

  it('shows the modal on click with custom "onClick" handler', async function () {
    const mockOnClick = jest.fn();
    render(
      <ComponentProviders>
        <FeatureFeedback
          featureName="test"
          buttonProps={{
            onClick: mockOnClick,
          }}
        />
      </ComponentProviders>
    );

    userEvent.click(screen.getByText('Give Feedback'));

    expect(await screen.findByText('Select type of feedback')).toBeInTheDocument();

    expect(mockOnClick).toHaveBeenCalled();
  });

  it('Close modal on click', async function () {
    render(
      <ComponentProviders>
        <FeatureFeedback featureName="test" />
      </ComponentProviders>
    );

    userEvent.click(screen.getByText('Give Feedback'));

    userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', {name: 'Submit Feedback'})
    );
  });
});
