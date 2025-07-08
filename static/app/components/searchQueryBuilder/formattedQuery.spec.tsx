import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  FormattedQuery,
  type FormattedQueryProps,
} from 'sentry/components/searchQueryBuilder/formattedQuery';
import type {TagCollection} from 'sentry/types/group';

const FILTER_KEYS: TagCollection = {
  lastSeen: {
    key: 'lastSeen',
    name: 'Last Seen',
  },
};

jest.mock('sentry/components/searchQueryBuilder/context', () => ({
  useSearchQueryBuilder: () => ({
    size: 'normal',
    getFieldDefinition: () => null,
  }),
}));

describe('FormattedQuery', function () {
  const defaultProps: Partial<FormattedQueryProps> = {
    filterKeys: FILTER_KEYS,
  };

  it('renders aggregate filters correctly', function () {
    render(<FormattedQuery {...defaultProps} query="count():>1" />);

    expect(screen.getByText(textWithMarkupMatcher('count() > 1'))).toBeInTheDocument();
  });

  it('renders filters with multiple values correctly', function () {
    render(<FormattedQuery {...defaultProps} query="browser.name:[Firefox,Chrome]" />);

    expect(
      screen.getByText(textWithMarkupMatcher('browser.name is Firefox or Chrome'))
    ).toBeInTheDocument();
  });

  it('renders "is" filter correctly', function () {
    render(<FormattedQuery {...defaultProps} query="is:unresolved" />);

    expect(screen.getByText(textWithMarkupMatcher('is unresolved'))).toBeInTheDocument();
  });

  it('renders relative date filter correctly', function () {
    render(<FormattedQuery {...defaultProps} query="lastSeen:-7d" />);

    expect(
      screen.getByText(textWithMarkupMatcher('lastSeen is after 7d ago'))
    ).toBeInTheDocument();
  });

  it('renders absolute date filter correctly', function () {
    render(<FormattedQuery {...defaultProps} query="lastSeen:>2024-01-01" />);

    expect(
      screen.getByText(textWithMarkupMatcher('lastSeen is after Jan 1, 2024'))
    ).toBeInTheDocument();
  });

  it('renders boolean logic correctly', function () {
    render(<FormattedQuery {...defaultProps} query="(a OR b)" />);

    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-parenthesis')).toHaveLength(2);
  });

  it('renders explicit string tag correctly', function () {
    render(<FormattedQuery {...defaultProps} query="tags[foo,string]:bar" />);

    expect(screen.getByText(textWithMarkupMatcher('foo is bar'))).toBeInTheDocument();
  });

  it('renders explicit number tag correctly', function () {
    render(<FormattedQuery {...defaultProps} query="tags[foo,number]:<=100" />);

    expect(screen.getByText(textWithMarkupMatcher('foo is <=100'))).toBeInTheDocument();
  });

  it('renders has explicit string tag correctly', function () {
    render(<FormattedQuery {...defaultProps} query="has:tags[foo,string]" />);

    expect(screen.getByText(textWithMarkupMatcher('has foo'))).toBeInTheDocument();
  });

  it('renders has number string tag correctly', function () {
    render(<FormattedQuery {...defaultProps} query="has:tags[foo,number]" />);

    expect(screen.getByText(textWithMarkupMatcher('has foo'))).toBeInTheDocument();
  });
});
