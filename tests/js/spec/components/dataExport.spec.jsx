import {
  act,
  fireEvent,
  mountWithTheme,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import WrappedDataExport from 'sentry/components/dataExport';

jest.mock('sentry/actionCreators/indicator');

const mockUnauthorizedOrg = TestStubs.Organization({
  features: [],
});
const mockAuthorizedOrg = TestStubs.Organization({
  features: ['discover-query'],
});
const mockPayload = {
  queryType: 'Issues-by-Tag',
  queryInfo: {project_id: '1', group_id: '1027', key: 'user'},
};
const mockRouterContext = mockOrganization =>
  TestStubs.routerContext([
    {
      organization: mockOrganization,
    },
  ]);

describe('DataExport', function () {
  it('should not render anything for an unauthorized organization', function () {
    mountWithTheme(<WrappedDataExport payload={mockPayload} />, {
      context: mockRouterContext(mockUnauthorizedOrg),
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render the button for an authorized organization', function () {
    mountWithTheme(<WrappedDataExport payload={mockPayload} />, {
      context: mockRouterContext(mockAuthorizedOrg),
    });
    expect(screen.getByText(/Export All to CSV/)).toBeInTheDocument();
  });

  it('should render custom children if provided', function () {
    mountWithTheme(
      <WrappedDataExport payload={mockPayload}>
        This is an example string
      </WrappedDataExport>,
      {context: mockRouterContext(mockAuthorizedOrg)}
    );
    expect(screen.getByText(/This is an example string/)).toBeInTheDocument();
  });

  it('should respect the disabled prop and not be clickable', function () {
    const postDataExport = MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    mountWithTheme(<WrappedDataExport payload={mockPayload} disabled />, {
      context: mockRouterContext(mockAuthorizedOrg),
    });

    fireEvent.click(screen.getByRole('button'));
    expect(postDataExport).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should send a request and disable itself when clicked', async function () {
    const postDataExport = MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });
    mountWithTheme(<WrappedDataExport payload={mockPayload} />, {
      context: mockRouterContext(mockAuthorizedOrg),
    });

    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(postDataExport).toHaveBeenCalledWith(
      `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      {
        data: {
          query_type: mockPayload.queryType,
          query_info: mockPayload.queryInfo,
        },
        method: 'POST',
        error: expect.anything(),
        success: expect.anything(),
      }
    );

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  it('should reset the state when receiving a new payload', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    const {rerender} = mountWithTheme(<WrappedDataExport payload={mockPayload} />, {
      context: mockRouterContext(mockAuthorizedOrg),
    });

    act(() => {
      fireEvent.click(screen.getByText(/Export All to CSV/));
    });
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });

    rerender(<WrappedDataExport payload={{...mockPayload, queryType: 'Discover'}} />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeEnabled();
    });
  });

  it('should display default error message if non provided', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      statusCode: 400,
    });

    mountWithTheme(<WrappedDataExport payload={mockPayload} />, {
      context: mockRouterContext(mockAuthorizedOrg),
    });

    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        "We tried our hardest, but we couldn't export your data. Give it another go."
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeEnabled();
    });
  });

  it('should display provided error message', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'uh oh'},
    });

    mountWithTheme(<WrappedDataExport payload={mockPayload} />, {
      context: mockRouterContext(mockAuthorizedOrg),
    });

    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('uh oh');
    });
  });
});
