import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ExportQueryType} from 'sentry/components/dataExport';
import DataDownload, {DownloadStatus} from 'sentry/views/dataExport/dataDownload';

describe('DataDownload', () => {
  beforeEach(MockApiClient.clearMockResponses);
  const dateExpired = new Date();
  const organization = OrganizationFixture();
  const dataExportId = '721';
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/data-export/${dataExportId}/`,
    },
    route: '/organizations/:orgId/data-export/:dataExportId/',
  };

  const getDataExportDetails = (body: any, statusCode = 200) =>
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/${dataExportId}/`,
      body,
      statusCode,
    });

  it('should send a request to the data export endpoint', () => {
    const getValid = getDataExportDetails(DownloadStatus.VALID);

    render(<DataDownload />, {initialRouterConfig});
    expect(getValid).toHaveBeenCalledTimes(1);
  });

  it("should render the 'Error' view when appropriate", async () => {
    const errors = {
      download: {
        status: 403,
        statusText: 'Forbidden',
        responseJSON: {
          detail: 'You are not allowed',
        },
      },
    };
    getDataExportDetails({errors}, 403);

    render(<DataDownload />, {initialRouterConfig});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getByText('403 -')).toBeInTheDocument(); // Either the code or the mock is mistaken about the data return format
  });

  it("should render the 'Early' view when appropriate", async () => {
    const status = DownloadStatus.EARLY;
    getDataExportDetails({status});

    render(<DataDownload />, {initialRouterConfig});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(
      screen.getByText(textWithMarkupMatcher('What are you doing here?'))
    ).toBeInTheDocument();
    expect(screen.getByText(/were you invited/)).toBeInTheDocument();
  });

  it("should render the 'Expired' view when appropriate", async () => {
    const status = DownloadStatus.EXPIRED;
    const response = {status, query: {type: ExportQueryType.ISSUES_BY_TAG}};
    getDataExportDetails(response);

    render(<DataDownload />, {initialRouterConfig});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getByText('This is awkward.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Start a New Download'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/`
    );
  });

  it("should render the 'Valid' view when appropriate", async () => {
    const status = DownloadStatus.VALID;
    getDataExportDetails({dateExpired, status});

    render(<DataDownload />, {initialRouterConfig});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getByText('All done.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download CSV'})).toHaveAttribute(
      'href',
      `/api/0/organizations/${organization.slug}/data-export/${dataExportId}/?download=true`
    );
    expect(
      screen.getByText(
        textWithMarkupMatcher("That link won't last forever — it expires:Oct 17, 2:41 AM")
      )
    ).toBeInTheDocument();
  });

  it('should render the Open in Discover button when needed', async () => {
    const status = DownloadStatus.VALID;
    getDataExportDetails({
      dateExpired,
      status,
      query: {
        type: ExportQueryType.DISCOVER,
        info: {},
      },
    });

    render(<DataDownload />, {initialRouterConfig});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeInTheDocument();
  });

  it('should not render the Open in Discover button when not needed', () => {
    const status = DownloadStatus.VALID;
    getDataExportDetails({
      dateExpired,
      status,
      query: {
        type: ExportQueryType.ISSUES_BY_TAG,
        info: {},
      },
    });

    render(<DataDownload />, {initialRouterConfig});
    expect(
      screen.queryByRole('button', {name: 'Open in Discover'})
    ).not.toBeInTheDocument();
  });

  it('should render the Open in Explore button when needed', async () => {
    const status = DownloadStatus.VALID;
    getDataExportDetails({
      dateExpired,
      status,
      query: {type: ExportQueryType.EXPLORE, info: {}},
    });

    render(<DataDownload />, {initialRouterConfig});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getByRole('button', {name: 'Open in Explore'})).toBeInTheDocument();
  });

  it('should render with null organization', async () => {
    const status = DownloadStatus.VALID;
    getDataExportDetails({
      dateExpired,
      status,
      query: {type: ExportQueryType.EXPLORE, info: {}},
    });

    render(<DataDownload />, {initialRouterConfig, organization: null});
    expect(
      await screen.findByRole('button', {name: 'Open in Explore'})
    ).toBeInTheDocument();
  });
});
