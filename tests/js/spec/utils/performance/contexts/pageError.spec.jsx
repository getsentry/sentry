import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  PageErrorAlert,
  PageErrorProvider,
  usePageError,
} from 'sentry/utils/performance/contexts/pageError';

function SimpleErrorButton() {
  const context = usePageError();
  return (
    <button
      data-test-id="pageErrorButton"
      onClick={() => context.setPageError('Fresh new error')}
    />
  );
}

describe('Performance > Contexts > pageError', function () {
  it('Check that pageError context will render error alert', async function () {
    mountWithTheme(
      <PageErrorProvider>
        <div data-test-id="errorAlert">
          <PageErrorAlert />
        </div>
        <SimpleErrorButton />
      </PageErrorProvider>
    );

    const button = await screen.findByTestId('pageErrorButton');

    userEvent.click(button);

    expect(await screen.findByTestId('errorAlert')).toHaveTextContent('Fresh new error');
  });
});
