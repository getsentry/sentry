import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import WrappedDataExport, {ExportQueryType} from 'sentry/components/dataExport';
import type {Organization} from 'sentry/types/organization';

jest.mock('sentry/actionCreators/indicator');

const mockUnauthorizedOrg = OrganizationFixture({
  features: [],
});

const mockAuthorizedOrg = OrganizationFixture({
  features: ['discover-query'],
});

const mockPayload = {
  queryType: ExportQueryType.ISSUES_BY_TAG,
  queryInfo: {project_id: '1', group_id: '1027', key: 'user'},
};

const mockContext = (organization: Organization) => {
  return {organization};
};

describe('DataExport', function () {
  it('should not render anything for an unauthorized organization', function () {
    render(<WrappedDataExport payload={mockPayload} />, {
      ...mockContext(mockUnauthorizedOrg),
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render the button for an authorized organization', function () {
    render(<WrappedDataExport payload={mockPayload} />, {
      ...mockContext(mockAuthorizedOrg),
    });
    expect(screen.getByText(/Export All to CSV/)).toBeInTheDocument();
  });

  it('should render custom children if provided', function () {
    render(
      <WrappedDataExport payload={mockPayload}>
        This is an example string
      </WrappedDataExport>,
      {...mockContext(mockAuthorizedOrg)}
    );
    expect(screen.getByText(/This is an example string/)).toBeInTheDocument();
  });

  it('should respect the disabled prop and not be clickable', async function () {
    const postDataExport = MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    render(<WrappedDataExport payload={mockPayload} disabled />, {
      ...mockContext(mockAuthorizedOrg),
    });

    await userEvent.click(screen.getByRole('button'));
    expect(postDataExport).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should send a request and disable itself when clicked', async function () {
    const postDataExport = MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });
    render(<WrappedDataExport payload={mockPayload} />, {
      ...mockContext(mockAuthorizedOrg),
    });

    await userEvent.click(screen.getByRole('button'));

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

    const {rerender} = render(<WrappedDataExport payload={mockPayload} />, {
      ...mockContext(mockAuthorizedOrg),
    });

    await userEvent.click(screen.getByText(/Export All to CSV/));
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });

    rerender(
      <WrappedDataExport
        payload={{...mockPayload, queryType: ExportQueryType.DISCOVER}}
      />
    );

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

    render(<WrappedDataExport payload={mockPayload} />, {
      ...mockContext(mockAuthorizedOrg),
    });

    await userEvent.click(screen.getByRole('button'));

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

    render(<WrappedDataExport payload={mockPayload} />, {
      ...mockContext(mockAuthorizedOrg),
    });

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('uh oh');
    });
  });
});
