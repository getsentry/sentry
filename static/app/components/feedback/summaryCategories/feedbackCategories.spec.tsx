import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {FeedbackCategories} from 'sentry/components/feedback/summaryCategories/feedbackCategories';
import {WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

jest.mock('sentry/components/events/autofix/useOrganizationSeerSetup');

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

  const initialRouterConfig = {
    location: {
      pathname: '/test',
      query: {query: ''},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseOrganizationSeerSetup.mockReturnValue({
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

      render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig,
      });

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
        initialRouterConfig,
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
        initialRouterConfig,
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

      render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig,
      });

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

      const {router} = render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig,
      });

      await userEvent.click(await screen.findByText('User Interface'));

      expect(router.location.query.query).toEqual(
        expect.stringContaining('ai_categorization.labels')
      );
    });

    it('removes filter when selected category is clicked again', async () => {
      const initialQuery = `ai_categorization.labels:${WildcardOperators.CONTAINS}["\\"Design\\"","\\"UI\\"","\\"User Interface\\""]`;

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

      const {router} = render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {query: initialQuery},
          },
        },
      });

      await userEvent.click(await screen.findByText('User Interface'));

      expect(router.location.query.query).not.toEqual(
        expect.stringContaining('ai_categorization.labels')
      );
    });

    it('replaces existing filter when different category is clicked', async () => {
      const initialQuery =
        'ai_categorization.labels:["*\\"Performance\\"*","*\\"Speed\\"*","*\\"Loading\\"*"]';

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

      const {router} = render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {query: initialQuery},
          },
        },
      });

      await userEvent.click(await screen.findByText('User Interface'));

      expect(router.location.query.query).toBe(
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

      const {router} = render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig,
      });

      await userEvent.click(await screen.findByText('Performance*'));

      const queryString = router.location.query.query;

      expect(queryString).toContain('ai_categorization.labels');
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

      const {router} = render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig,
      });

      await userEvent.click(await screen.findByText('User "Interface"'));

      const queryString = router.location.query.query;

      expect(queryString).toContain('ai_categorization.labels');
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

      const {router} = render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig,
      });

      await userEvent.click(await screen.findByText('API* "Integration"'));

      const queryString = router.location.query.query;

      expect(queryString).toContain('ai_categorization.labels');
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

      const {router} = render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig,
      });

      await userEvent.click(await screen.findByText('Standalone* "Category"'));

      const queryString = router.location.query.query;

      expect(queryString).toContain('ai_categorization.labels');
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

      const {router} = render(<FeedbackCategories />, {
        organization: mockOrganization,
        initialRouterConfig,
      });

      await userEvent.click(await screen.findByText('Test* "Category"'));

      const queryString = router.location.query.query;

      const expectedQuery = `ai_categorization.labels:${WildcardOperators.CONTAINS}["\\"Another \\\\\\"Label\\\\\\"\\"","\\"Associated\\* \\\\\\"Label\\\\\\"\\"","\\"Test\\* \\\\\\"Category\\\\\\"\\""]`;

      expect(queryString).toContain('ai_categorization.labels');
      expect(queryString).toBe(expectedQuery);
    });
  });
});
