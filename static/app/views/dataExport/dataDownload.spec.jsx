import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ExportQueryType} from 'sentry/components/dataExport';
import DataDownload, {DownloadStatus} from 'sentry/views/dataExport/dataDownload';

describe('DataDownload', function () {
  beforeEach(MockApiClient.clearMockResponses);
  const dateExpired = new Date();
  const organization = TestStubs.Organization();
  const mockRouteParams = {
    orgId: organization.slug,
    dataExportId: 721,
  };

  const getDataExportDetails = (body, statusCode = 200) =>
    MockApiClient.addMockResponse({
      url: `/organizations/${mockRouteParams.orgId}/data-export/${mockRouteParams.dataExportId}/`,
      body,
      statusCode,
    });

  it('should send a request to the data export endpoint', function () {
    const getValid = getDataExportDetails(DownloadStatus.Valid);

    render(<DataDownload params={mockRouteParams} />);
    expect(getValid).toHaveBeenCalledTimes(1);
  });

  it("should render the 'Error' view when appropriate", function () {
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

    render(<DataDownload params={mockRouteParams} />);
    expect(screen.getByText('403 -')).toBeInTheDocument(); // Either the code or the mock is mistaken about the data return format
  });

  it("should render the 'Early' view when appropriate", function () {
    const status = DownloadStatus.Early;
    getDataExportDetails({status});

    render(<DataDownload params={mockRouteParams} />);
    expect(
      screen.getByText(textWithMarkupMatcher('What are you doing here?'))
    ).toBeInTheDocument();
    expect(screen.getByText(/were you invited/)).toBeInTheDocument();
  });

  it("should render the 'Expired' view when appropriate", function () {
    const status = DownloadStatus.Expired;
    const response = {status, query: {type: ExportQueryType.IssuesByTag}};
    getDataExportDetails(response);

    render(<DataDownload params={mockRouteParams} />);
    expect(screen.getByText('This is awkward.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Start a New Download'})).toHaveAttribute(
      'href',
      `/organizations/${mockRouteParams.orgId}/issues/`
    );
  });

  it("should render the 'Valid' view when appropriate", function () {
    const status = DownloadStatus.Valid;
    getDataExportDetails({dateExpired, status});

    render(<DataDownload params={mockRouteParams} />);
    expect(screen.getByText('All done.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download CSV'})).toHaveAttribute(
      'href',
      `/api/0/organizations/${mockRouteParams.orgId}/data-export/${mockRouteParams.dataExportId}/?download=true`
    );
    expect(
      screen.getByText(
        textWithMarkupMatcher("That link won't last forever — it expires:Oct 17, 2:41 AM")
      )
    ).toBeInTheDocument();
  });

  it('should render the Open in Discover button when needed', function () {
    const status = DownloadStatus.Valid;
    getDataExportDetails({
      dateExpired,
      status,
      query: {
        type: ExportQueryType.Discover,
        info: {},
      },
    });

    render(<DataDownload params={mockRouteParams} />);
    expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeInTheDocument();
  });

  it('should not render the Open in Discover button when not needed', function () {
    const status = DownloadStatus.Valid;
    getDataExportDetails({
      dateExpired,
      status,
      query: {
        type: ExportQueryType.IssuesByTag,
        info: {},
      },
    });

    render(<DataDownload params={mockRouteParams} />);
    expect(
      screen.queryByRole('button', {name: 'Open in Discover'})
    ).not.toBeInTheDocument();
  });
});
