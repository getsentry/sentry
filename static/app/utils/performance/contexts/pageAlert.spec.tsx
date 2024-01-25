import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  PageAlert,
  PageAlertProvider,
  usePageAlert,
} from 'sentry/utils/performance/contexts/pageAlert';

function SimpleErrorButton() {
  const {setPageError} = usePageAlert();
  return (
    <button
      data-test-id="pageErrorButton"
      onClick={() => setPageError('Fresh new error')}
    />
  );
}

describe('Performance > Contexts > pageError', function () {
  it('Check that pageError context will render error alert', async function () {
    render(
      <PageAlertProvider>
        <div data-test-id="errorAlert">
          <PageAlert />
        </div>
        <SimpleErrorButton />
      </PageAlertProvider>
    );

    const button = await screen.findByTestId('pageErrorButton');

    await userEvent.click(button);

    expect(await screen.findByTestId('errorAlert')).toHaveTextContent('Fresh new error');
  });
});
