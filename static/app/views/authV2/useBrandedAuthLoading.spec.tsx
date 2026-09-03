import {Fragment, useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  BrandedAuthLoadingProvider,
  useBrandedAuthLoading,
} from 'sentry/views/authV2/useBrandedAuthLoading';

function LoadingReporter({isLoading}: {isLoading: boolean}) {
  useBrandedAuthLoading(isLoading);

  return null;
}

function TestPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(true);

  return (
    <BrandedAuthLoadingProvider>
      {isPageLoading => (
        <Fragment>
          <div>{isPageLoading ? 'Loading authentication' : 'Authentication ready'}</div>
          {isMounted && <LoadingReporter isLoading={isLoading} />}
          <button onClick={() => setIsLoading(false)}>Finish loading</button>
          <button onClick={() => setIsMounted(false)}>Unmount page</button>
        </Fragment>
      )}
    </BrandedAuthLoadingProvider>
  );
}

describe('useBrandedAuthLoading', () => {
  it('reports loading state and restores it when the page unmounts', async () => {
    render(<TestPage />);

    expect(screen.getByText('Loading authentication')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Finish loading'}));
    expect(screen.getByText('Authentication ready')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Unmount page'}));
    expect(screen.getByText('Loading authentication')).toBeInTheDocument();
  });
});
