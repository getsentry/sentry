import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {
  PageErrorAlert,
  PageErrorProvider,
  usePageError,
} from 'app/utils/performance/contexts/pageError';

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
  const {routerContext} = initializeOrg({
    router: {orgId: 'orgId'},
  });

  it('Check that pageError context will render error alert', async function () {
    const wrapper = mountWithTheme(
      <PageErrorProvider>
        <div data-test-id="errorAlert">
          <PageErrorAlert />
        </div>
        <SimpleErrorButton />
      </PageErrorProvider>,
      {context: routerContext}
    );

    const button = await wrapper.findByTestId('pageErrorButton');

    await fireEvent.click(button);

    expect(await wrapper.findByTestId('errorAlert')).toHaveTextContent('Fresh new error');
  });
});
