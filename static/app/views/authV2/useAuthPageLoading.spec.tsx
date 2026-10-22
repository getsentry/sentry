import {Fragment, useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {
  AuthPageLoadingProvider,
  useAuthPageLoading,
} from 'sentry/views/authV2/useAuthPageLoading';

function LoadingReporter({isLoading}: {isLoading: boolean}) {
  useAuthPageLoading(isLoading);

  return null;
}

function TestPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(true);

  return (
    <AuthPageLoadingProvider>
      {isPageLoading => (
        <Fragment>
          <div>{isPageLoading ? 'Loading authentication' : 'Authentication ready'}</div>
          {isMounted && <LoadingReporter isLoading={isLoading} />}
          <Button onClick={() => setIsLoading(false)}>Finish loading</Button>
          <Button onClick={() => setIsMounted(false)}>Unmount page</Button>
        </Fragment>
      )}
    </AuthPageLoadingProvider>
  );
}

describe('useAuthPageLoading', () => {
  it('reports loading state and restores it when the page unmounts', async () => {
    render(<TestPage />);

    expect(screen.getByText('Loading authentication')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Finish loading'}));
    expect(screen.getByText('Authentication ready')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Unmount page'}));
    expect(screen.getByText('Loading authentication')).toBeInTheDocument();
  });
});
