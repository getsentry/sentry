import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import UnsubscribeIssue from 'sentry/views/unsubscribe/issue';

describe('UnsubscribeIssue', function () {
  const params = {orgId: 'acme', id: '9876'};
  let mockUpdate, mockGet;
  beforeEach(() => {
    mockUpdate = MockApiClient.addMockResponse({
      url: '/organizations/acme/unsubscribe/issue/9876/?_=signature-value',
      method: 'POST',
      status: 201,
    });
    mockGet = MockApiClient.addMockResponse({
      url: '/organizations/acme/unsubscribe/issue/9876/',
      method: 'GET',
      status: 200,
      body: {
        viewUrl: 'https://acme.sentry.io/issue/9876/',
        type: 'issue',
        displayName: 'Bruce Wayne',
      },
    });
  });

  it('loads data from the the API based on URL parameters', async function () {
    const {router, routerProps, routerContext} = initializeOrg({
      router: {
        location: {query: {_: 'signature-value'}},
        params,
      },
    });
    render(
      <UnsubscribeIssue {...routerProps} location={router.location} params={params} />,
      {context: routerContext}
    );

    expect(await screen.findByText('selected issue')).toBeInTheDocument();
    expect(screen.getByText('workflow notifications')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Unsubscribe'})).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalled();
  });

  it('makes an API request when the form is submitted', async function () {
    const {router, routerProps, routerContext} = initializeOrg({
      router: {
        location: {query: {_: 'signature-value'}},
        params,
      },
    });
    render(
      <UnsubscribeIssue {...routerProps} location={router.location} params={params} />,
      {context: routerContext}
    );

    expect(await screen.findByText('selected issue')).toBeInTheDocument();
    const button = screen.getByRole('button', {name: 'Unsubscribe'});
    await userEvent.click(button);

    expect(mockUpdate).toHaveBeenCalledWith(
      '/organizations/acme/unsubscribe/issue/9876/?_=signature-value',
      expect.objectContaining({data: {cancel: 1}})
    );
  });
});
