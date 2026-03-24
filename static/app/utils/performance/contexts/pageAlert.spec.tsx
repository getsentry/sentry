import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  PageAlert,
  PageAlertProvider,
  usePageAlert,
} from 'sentry/utils/performance/contexts/pageAlert';

function SimpleErrorButton() {
  const {setPageDanger} = usePageAlert();
  return (
    <button
      data-test-id="pageErrorButton"
      onClick={() => setPageDanger('Fresh new error')}
    />
  );
}

describe('Performance > Contexts > pageError', () => {
  it('Check that pageError context will render error alert', async () => {
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

  it('prevents unnecessary re-renders when setting the same message multiple times', async () => {
    let renderCount = 0;

    function RenderCountingComponent() {
      const {setPageDanger} = usePageAlert();
      renderCount++;

      return (
        <div>
          <div data-test-id="render-count">{renderCount}</div>
          <button
            data-test-id="set-error"
            onClick={() => setPageDanger('Same error message')}
          />
        </div>
      );
    }

    render(
      <PageAlertProvider>
        <PageAlert />
        <RenderCountingComponent />
      </PageAlertProvider>
    );

    const button = screen.getByTestId('set-error');

    // Initial render count
    expect(screen.getByTestId('render-count')).toHaveTextContent('1');

    // Click once - should trigger a re-render
    await userEvent.click(button);
    expect(screen.getByTestId('render-count')).toHaveTextContent('2');
    expect(screen.getByTestId('page-error-alert')).toHaveTextContent(
      'Same error message'
    );

    // Click again with same message - should NOT trigger a re-render
    await userEvent.click(button);
    expect(screen.getByTestId('render-count')).toHaveTextContent('2');

    // Click a third time - still should NOT trigger a re-render
    await userEvent.click(button);
    expect(screen.getByTestId('render-count')).toHaveTextContent('2');
  });
});
