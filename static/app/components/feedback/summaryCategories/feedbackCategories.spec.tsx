import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import FeedbackCategories from 'sentry/components/feedback/summaryCategories/feedbackCategories';
import {WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');
jest.mock('sentry/components/events/autofix/useOrganizationSeerSetup');

const mockUseLocation = jest.mocked(useLocation);
const mockUseNavigate = jest.mocked(useNavigate);
const mockUseOrganizationSeerSetup = jest.mocked(useOrganizationSeerSetup);

describe('FeedbackCategories', () => {
  const mockOrganization = OrganizationFixture({
    slug: 'org-slug',
  });

  const mockCategories = [
    {
      primaryLabel: 'User Interface',
      associatedLabels: ['UI', 'Design'],
      feedbackCount: 15,
    },
    {
      primaryLabel: 'Performance',
      associatedLabels: ['Speed', 'Loading'],
      feedbackCount: 8,
    },
    {
      primaryLabel: 'Authentication',
      associatedLabels: ['Login', 'Security'],
      feedbackCount: 12,
    },
  ];

  const mockLocation = LocationFixture({
    query: {query: ''},
    pathname: '/test',
  });

  let mockNavigate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseLocation.mockReturnValue(mockLocation);
    mockUseOrganizationSeerSetup.mockReturnValue({
      setupAcknowledgement: {
        orgHasAcknowledged: true,
      },
      isPending: false,
    } as any);
  });

  describe('Component Rendering', () => {
    it('renders loading state', () => {
      // Mock API to return loading state
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: null,
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    });

    it('renders too few feedbacks state', async () => {
      // Mock API to return too few feedbacks
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: [],
          numFeedbacksContext: 0,
          success: false,
        },
        statusCode: 200,
      });

      const {container} = render(<FeedbackCategories />, {
        organization: mockOrganization,
      });

      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-placeholder'));

      expect(container).toBeEmptyDOMElement();
    });

    it('renders empty state when no categories', async () => {
      // Mock API to return empty categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: [],
          numFeedbacksContext: 15,
          success: true,
        },
        statusCode: 200,
      });

      const {container} = render(<FeedbackCategories />, {
        organization: mockOrganization,
      });

      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-placeholder'));

      expect(container).toBeEmptyDOMElement();
    });

    it('renders empty state when org has not acknowledged', async () => {
      mockUseOrganizationSeerSetup.mockReturnValue({
        setupAcknowledgement: {
          orgHasAcknowledged: false,
        },
        isPending: false,
      } as any);

      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: mockCategories,
          numFeedbacksContext: 35,
          success: true,
        },
        statusCode: 200,
      });

      const {container} = render(<FeedbackCategories />, {
        organization: mockOrganization,
      });

      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-placeholder'));

      expect(container).toBeEmptyDOMElement();
    });

    it('renders categories when available', async () => {
      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: mockCategories,
          numFeedbacksContext: 35,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      expect(await screen.findByText('User Interface')).toBeInTheDocument();
      expect(await screen.findByText('Performance')).toBeInTheDocument();
      expect(await screen.findByText('Authentication')).toBeInTheDocument();
    });
  });

  describe('Search Integration with MutableSearch', () => {
    it('adds filter when category is clicked', async () => {
      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: mockCategories,
          numFeedbacksContext: 35,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      await userEvent.click(await screen.findByText('User Interface'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('ai_categorization.labels'),
          }),
        })
      );
    });

    it('removes filter when selected category is clicked again', async () => {
      const locationWithFilter = LocationFixture({
        query: {
          query: `ai_categorization.labels:${WildcardOperators.CONTAINS}["\\"Design\\"","\\"UI\\"","\\"User Interface\\""]`,
        },
      });

      mockUseLocation.mockReturnValue(locationWithFilter);

      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: mockCategories,
          numFeedbacksContext: 35,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      await userEvent.click(await screen.findByText('User Interface'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.not.stringContaining('ai_categorization.labels'),
          }),
        })
      );
    });

    it('replaces existing filter when different category is clicked', async () => {
      // Mock location with existing filter for Performance category
      const locationWithFilter = LocationFixture({
        query: {
          query:
            'ai_categorization.labels:["*\\"Performance\\"*","*\\"Speed\\"*","*\\"Loading\\"*"]',
        },
      });

      mockUseLocation.mockReturnValue(locationWithFilter);

      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: mockCategories,
          numFeedbacksContext: 35,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      await userEvent.click(await screen.findByText('User Interface'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('ai_categorization.labels'),
          }),
        })
      );

      const navigateCall = mockNavigate.mock.calls[0][0];
      const queryString = navigateCall.query.query;

      expect(queryString).toBe(
        `ai_categorization.labels:${WildcardOperators.CONTAINS}["\\"Design\\"","\\"UI\\"","\\"User Interface\\""]`
      );
    });
  });

  describe('Search Query Construction', () => {
    it('handles special characters in search terms correctly', () => {
      const search = new MutableSearch('');
      const mockSearchTerm =
        '["*\\"UI/UX Design\\"*","*\\"User Experience\\"*","*\\"Frontend\\"*"]';

      search.addFilterValue('ai_categorization.labels', mockSearchTerm, false);

      const formattedQuery = search.formatString();

      // Should handle special characters without breaking
      expect(formattedQuery).toContain('ai_categorization.labels:');
      expect(formattedQuery).toContain('UI/UX Design');
    });

    it('properly escapes asterisks in category labels', async () => {
      const categoriesWithAsterisks = [
        {
          primaryLabel: 'Performance*',
          associatedLabels: ['Speed*', 'Loading*'],
          feedbackCount: 8,
        },
      ];

      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: categoriesWithAsterisks,
          numFeedbacksContext: 8,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      await userEvent.click(await screen.findByText('Performance*'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('ai_categorization.labels'),
          }),
        })
      );

      // Get the actual query that was passed to navigate
      const navigateCall = mockNavigate.mock.calls[0][0];
      const queryString = navigateCall.query.query;

      expect(queryString).toContain('Performance\\*');
      expect(queryString).toContain('Speed\\*');
      expect(queryString).toContain('Loading\\*');
    });

    it('properly escapes quotes in category labels', async () => {
      const categoriesWithQuotes = [
        {
          primaryLabel: 'User "Interface"',
          associatedLabels: ['UI "Design"', 'Frontend "UX"'],
          feedbackCount: 15,
        },
      ];

      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: categoriesWithQuotes,
          numFeedbacksContext: 15,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      await userEvent.click(await screen.findByText('User "Interface"'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('ai_categorization.labels'),
          }),
        })
      );

      // Get the actual query that was passed to navigate
      const navigateCall = mockNavigate.mock.calls[0][0];
      const queryString = navigateCall.query.query;

      // In memory, each quote should have exactly three backslashes before it
      // We go from User "Interface" to User \"Interface\" in the first JSON.stringify, and this is exactly what we want to exact match for in the array of labels
      // Then, we need two more backslashes; first one indicates the second one is one to exact match for, and the third indicates that the quote is for exact matching
      expect(queryString).toContain('User \\\\\\"Interface\\\\\\"');
      expect(queryString).toContain('UI \\\\\\"Design\\\\\\"');
      expect(queryString).toContain('Frontend \\\\\\"UX\\\\\\"');
    });

    it('properly escapes multiple special characters in complex labels', async () => {
      const categoriesWithComplexLabels = [
        {
          primaryLabel: 'API* "Integration"',
          associatedLabels: ['REST* "Endpoints"', 'GraphQL* "Queries"'],
          feedbackCount: 20,
        },
      ];

      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: categoriesWithComplexLabels,
          numFeedbacksContext: 20,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      await userEvent.click(await screen.findByText('API* "Integration"'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('ai_categorization.labels'),
          }),
        })
      );

      // Get the actual query that was passed to navigate
      const navigateCall = mockNavigate.mock.calls[0][0];
      const queryString = navigateCall.query.query;

      expect(queryString).toContain('API\\* \\\\\\"Integration\\\\\\"');
      expect(queryString).toContain('REST\\* \\\\\\"Endpoints\\\\\\"');
      expect(queryString).toContain('GraphQL\\* \\\\\\"Queries\\\\\\"');
    });

    it('handles empty associated labels correctly', async () => {
      const categoriesWithNoAssociatedLabels = [
        {
          primaryLabel: 'Standalone* "Category"',
          associatedLabels: [],
          feedbackCount: 5,
        },
      ];

      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: categoriesWithNoAssociatedLabels,
          numFeedbacksContext: 5,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      await userEvent.click(await screen.findByText('Standalone* "Category"'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('ai_categorization.labels'),
          }),
        })
      );

      // Get the actual query that was passed to navigate
      const navigateCall = mockNavigate.mock.calls[0][0];
      const queryString = navigateCall.query.query;

      expect(queryString).toContain('Standalone\\* \\\\\\"Category\\\\\\"');
    });

    it('generates exact query string format with proper array syntax and wildcards', async () => {
      const testCategories = [
        {
          primaryLabel: 'Test* "Category"',
          associatedLabels: ['Associated* "Label"', 'Another "Label"'],
          feedbackCount: 10,
        },
      ];

      // Mock API to return categories
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/feedback-categories/',
        body: {
          categories: testCategories,
          numFeedbacksContext: 10,
          success: true,
        },
        statusCode: 200,
      });

      render(<FeedbackCategories />, {organization: mockOrganization});

      await userEvent.click(await screen.findByText('Test* "Category"'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('ai_categorization.labels'),
          }),
        })
      );

      // Get the actual query that was passed to navigate
      const navigateCall = mockNavigate.mock.calls[0][0];
      const queryString = navigateCall.query.query;

      const expectedQuery = `ai_categorization.labels:${WildcardOperators.CONTAINS}["\\"Another \\\\\\"Label\\\\\\"\\"","\\"Associated\\* \\\\\\"Label\\\\\\"\\"","\\"Test\\* \\\\\\"Category\\\\\\"\\""]`;

      expect(queryString).toBe(expectedQuery);
    });
  });
});
