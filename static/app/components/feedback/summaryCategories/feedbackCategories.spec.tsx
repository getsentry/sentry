import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import useFeedbackCategories from 'sentry/components/feedback/list/useFeedbackCategories';
import FeedbackCategories from 'sentry/components/feedback/summaryCategories/feedbackCategories';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

jest.mock('sentry/components/feedback/list/useFeedbackCategories');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockUseFeedbackCategories = useFeedbackCategories as jest.MockedFunction<
  typeof useFeedbackCategories
>;
const mockUseLocation = jest.mocked(useLocation);
const mockUseNavigate = jest.mocked(useNavigate);

describe('FeedbackCategories', () => {
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
  });

  describe('Component Rendering', () => {
    it('renders loading state with skeleton', () => {
      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: true,
        categories: null,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    });

    it('renders error state', () => {
      mockUseFeedbackCategories.mockReturnValue({
        isError: true,
        isPending: false,
        categories: null,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      expect(screen.getByText('Error loading feedback categories.')).toBeInTheDocument();
    });

    it('renders too few feedbacks state', () => {
      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: null,
        tooFewFeedbacks: true,
      });

      render(<FeedbackCategories />);

      expect(
        screen.getByText('Not enough feedback to categorize and group')
      ).toBeInTheDocument();
    });

    it('renders empty state when no categories', () => {
      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: [],
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      expect(screen.getByText('No feedback categories found.')).toBeInTheDocument();
    });

    it('renders categories when available', () => {
      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: mockCategories,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      expect(screen.getByText('User Interface (15)')).toBeInTheDocument();
      expect(screen.getByText('Performance (8)')).toBeInTheDocument();
      expect(screen.getByText('Authentication (12)')).toBeInTheDocument();
    });
  });

  describe('Search Integration with MutableSearch', () => {
    it('adds filter when category is clicked', async () => {
      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: mockCategories,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      await userEvent.click(screen.getByText('User Interface (15)'));

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
          query:
            'ai_categorization.labels:["*\\"Design\\"*","*\\"UI\\"*","*\\"User Interface\\"*"]',
        },
      });

      mockUseLocation.mockReturnValue(locationWithFilter);

      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: mockCategories,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      await userEvent.click(screen.getByText('User Interface (15)'));

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

      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: mockCategories,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      await userEvent.click(screen.getByText('User Interface (15)'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('ai_categorization.labels'),
          }),
        })
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

      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: categoriesWithAsterisks,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      await userEvent.click(screen.getByText('Performance* (8)'));

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

      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: categoriesWithQuotes,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      await userEvent.click(screen.getByText('User "Interface" (15)'));

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

      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: categoriesWithComplexLabels,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      await userEvent.click(screen.getByText('API* "Integration" (20)'));

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

      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: categoriesWithNoAssociatedLabels,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      await userEvent.click(screen.getByText('Standalone* "Category" (5)'));

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

      mockUseFeedbackCategories.mockReturnValue({
        isError: false,
        isPending: false,
        categories: testCategories,
        tooFewFeedbacks: false,
      });

      render(<FeedbackCategories />);

      await userEvent.click(screen.getByText('Test* "Category" (10)'));

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

      const expectedQuery =
        'ai_categorization.labels:["*\\"Another \\\\\\"Label\\\\\\"\\"*","*\\"Associated\\* \\\\\\"Label\\\\\\"\\"*","*\\"Test\\* \\\\\\"Category\\\\\\"\\"*"]';

      expect(queryString).toBe(expectedQuery);
    });
  });
});
