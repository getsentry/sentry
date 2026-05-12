import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DataExport} from 'sentry/components/exports/dataExport';
import {ExportQueryType} from 'sentry/components/exports/useDataExport';
import type {Organization} from 'sentry/types/organization';

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

describe('DataExport', () => {
  it('should not render anything for an unauthorized organization', () => {
    render(<DataExport payload={mockPayload} />, {
      ...mockContext(mockUnauthorizedOrg),
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render the button for an authorized organization', () => {
    render(<DataExport payload={mockPayload} />, {
      ...mockContext(mockAuthorizedOrg),
    });
    expect(screen.getByText(/Export All to CSV/)).toBeInTheDocument();
  });

  it('should render the button for an unauthorized organization using flag override', () => {
    render(<DataExport payload={mockPayload} overrideFeatureFlags />, {
      ...mockContext(mockUnauthorizedOrg),
    });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should render custom children if provided', () => {
    render(<DataExport payload={mockPayload}>This is an example string</DataExport>, {
      ...mockContext(mockAuthorizedOrg),
    });
    expect(screen.getByText(/This is an example string/)).toBeInTheDocument();
  });

  it('should respect the disabled prop and not be clickable', async () => {
    const postDataExport = MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    render(<DataExport payload={mockPayload} disabled />, {
      ...mockContext(mockAuthorizedOrg),
    });

    await userEvent.click(screen.getByRole('button'));
    expect(postDataExport).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should send a request and disable itself when clicked', async () => {
    const postDataExport = MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });
    render(<DataExport payload={mockPayload} />, {
      ...mockContext(mockAuthorizedOrg),
    });

    await userEvent.click(screen.getByRole('button'));

    expect(postDataExport).toHaveBeenCalledWith(
      `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      {
        data: {
          format: 'csv',
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

  it('should reset the state when receiving a new payload', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    const {rerender} = render(<DataExport payload={mockPayload} />, {
      ...mockContext(mockAuthorizedOrg),
    });

    await userEvent.click(screen.getByText(/Export All to CSV/));
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });

    rerender(
      <DataExport payload={{...mockPayload, queryType: ExportQueryType.DISCOVER}} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeEnabled();
    });
  });
});
