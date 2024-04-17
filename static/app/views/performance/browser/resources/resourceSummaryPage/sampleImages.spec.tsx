import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {DetailedOrganization} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import SampleImages from 'sentry/views/performance/browser/resources/resourceSummaryPage/sampleImages';
import {SpanIndexedField} from 'sentry/views/starfish/types';

const {SPAN_GROUP, HTTP_RESPONSE_CONTENT_LENGTH, RAW_DOMAIN, SPAN_DESCRIPTION} =
  SpanIndexedField;

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('SampleImages', function () {
  const organization = OrganizationFixture({
    features: ['starfish-view', 'spans-first-ui'],
  });

  beforeEach(() => {
    setupMocks(organization);
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  describe('When project setting is enabled', () => {
    beforeEach(() => {
      setupMockRequests(organization, {enableImages: true});
    });
    it('should render images', async () => {
      render(<SampleImages groupId="group123" projectId={2} />);
      await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

      const sampleImages = screen.queryAllByTestId('sample-image');

      expect(sampleImages[0]).toHaveAttribute('src', 'https://cdn.com/image.png');
      expect(sampleImages[1]).toHaveAttribute('src', 'https://cdn.com/image2.png');
    });
  });

  describe('When project setting is disabled', () => {
    beforeEach(() => {
      setupMockRequests(organization, {enableImages: false});
    });

    it('should ask to enable images', async () => {
      render(<SampleImages groupId="group123" projectId={2} />);
      await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
      expect(screen.queryByTestId('sample-image')).not.toBeInTheDocument();
      expect(screen.queryByTestId('enable-sample-images-button')).toBeInTheDocument();
    });
  });
});

const setupMocks = (organization: DetailedOrganization) => {
  const mockProjects = [ProjectFixture()];
  ProjectsStore.loadInitialData(mockProjects);

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [2],
    },
  });

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);
};

const setupMockRequests = (
  organization: DetailedOrganization,
  settings: {enableImages: boolean} = {enableImages: true}
) => {
  const {enableImages} = settings;

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({referrer: 'api.performance.resources.sample-images'}),
    ],
    body: {
      data: [
        {
          [SPAN_GROUP]: 'group123',
          [`measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`]: 1234,
          project: 'javascript',
          [SPAN_DESCRIPTION]: 'https://cdn.com/image.png',
          'any(id)': 'anyId123',
          [RAW_DOMAIN]: '',
        },
        {
          [SPAN_GROUP]: 'group123',
          [`measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`]: 1234,
          project: 'javascript',
          [SPAN_DESCRIPTION]: '/image2.png',
          'any(id)': 'anyId123',
          [RAW_DOMAIN]: 'https://cdn.com',
        },
      ],
    },
  });
  MockApiClient.addMockResponse({
    url: `/api/0/projects/org-slug/project-slug/performance/configure/`,
    method: 'GET',
    body: {
      enable_images: enableImages,
    },
  });
};
