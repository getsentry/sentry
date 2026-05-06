import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ExportQueryType, useDataExport} from 'sentry/components/exports/useDataExport';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';

jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/utils/downloadFromHref');

const mockAuthorizedOrg = OrganizationFixture({
  features: ['discover-query'],
});

const mockPayload = {
  queryType: ExportQueryType.ISSUES_BY_TAG,
  queryInfo: {project_id: '1', group_id: '1027', key: 'user'},
};

const requestBase = {
  url: `/organizations/${mockAuthorizedOrg.slug}/data-export/`,
  method: 'POST',
};

describe('useDataExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display default error message on failure when none is provided', async () => {
    const inProgressCallback = jest.fn();

    MockApiClient.addMockResponse({
      ...requestBase,
      statusCode: 400,
    });

    const {result} = renderHookWithProviders(() => useDataExport({inProgressCallback}), {
      organization: mockAuthorizedOrg,
    });

    await result.current({...mockPayload});

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        "We tried our hardest, but we couldn't export your data. Try waiting a minute then giving it another go."
      );
    });

    expect(inProgressCallback).toHaveBeenCalledWith(false);
  });

  it('should display the provided error message on failure when one is provided', async () => {
    const inProgressCallback = jest.fn();
    const detail = 'Oh no!';

    MockApiClient.addMockResponse({
      ...requestBase,
      statusCode: 400,
      body: {detail},
    });

    const {result} = renderHookWithProviders(() => useDataExport({inProgressCallback}), {
      organization: mockAuthorizedOrg,
    });

    await result.current({...mockPayload});

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(detail);
    });

    expect(inProgressCallback).toHaveBeenCalledWith(false);
  });

  it('should not add an error message when unmountedRef is already true', async () => {
    MockApiClient.addMockResponse({
      ...requestBase,
      statusCode: 400,
    });

    const unmountedRef = {current: true};

    const {result} = renderHookWithProviders(() => useDataExport({unmountedRef}), {
      organization: mockAuthorizedOrg,
    });

    await result.current({...mockPayload});

    expect(addErrorMessage).not.toHaveBeenCalled();
  });

  it('should notify when export is queued (201, no fileName)', async () => {
    MockApiClient.addMockResponse({
      ...requestBase,
      statusCode: 201,
      body: {id: 721},
    });

    const {result} = renderHookWithProviders(() => useDataExport(), {
      organization: mockAuthorizedOrg,
    });

    await result.current({...mockPayload});

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith(
        "Sit tight. We'll shoot you an email when your data is ready for download."
      );
    });
  });

  it('should notify when a duplicate export is detected (non-201)', async () => {
    MockApiClient.addMockResponse({
      ...requestBase,
      statusCode: 200,
      body: {id: 721},
    });

    const {result} = renderHookWithProviders(() => useDataExport(), {
      organization: mockAuthorizedOrg,
    });

    await result.current({...mockPayload});

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith(
        "It looks like we're already working on it. Sit tight, we'll email you."
      );
    });
  });

  it('should start a browser download when fileName is returned', async () => {
    MockApiClient.addMockResponse({
      ...requestBase,
      statusCode: 201,
      body: {id: 99184, fileName: 'export.csv'},
    });

    const {result} = renderHookWithProviders(() => useDataExport(), {
      organization: mockAuthorizedOrg,
    });

    await result.current({format: 'csv', ...mockPayload});

    await waitFor(() => {
      expect(downloadFromHref).toHaveBeenCalledWith(
        expect.stringMatching(/^export\.csv .+\.csv$/),
        '/api/0/organizations/org-slug/data-export/99184/?download=true'
      );
    });

    expect(addSuccessMessage).toHaveBeenCalledWith(
      "Downloading 'export.csv' to your browser."
    );
  });

  it('should use payload when provided', async () => {
    const exportMock = MockApiClient.addMockResponse({
      ...requestBase,
      statusCode: 201,
      body: {id: 721},
    });

    const {result} = renderHookWithProviders(() => useDataExport(), {
      organization: mockAuthorizedOrg,
    });

    await result.current({
      format: 'csv',
      queryInfo: mockPayload.queryInfo,
      queryType: mockPayload.queryType,
      limit: 10_000,
    });

    expect(exportMock).toHaveBeenCalledWith('/organizations/org-slug/data-export/', {
      data: {
        format: 'csv',
        query_type: mockPayload.queryType,
        query_info: mockPayload.queryInfo,
        limit: 10_000,
      },
      error: expect.any(Function),
      method: 'POST',
      success: expect.any(Function),
    });
  });

  it('should call inProgressCallback with true when an export starts', async () => {
    const inProgressCallback = jest.fn();

    MockApiClient.addMockResponse({
      ...requestBase,
      statusCode: 201,
      body: {id: 721},
    });

    const {result} = renderHookWithProviders(() => useDataExport({inProgressCallback}), {
      organization: mockAuthorizedOrg,
    });

    const exportPromise = result.current({...mockPayload});
    expect(inProgressCallback).toHaveBeenCalledWith(true);
    await exportPromise;
  });
});
