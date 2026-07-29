import {act, render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules, textWithMarkupMatcher} from 'sentry-test/utils';

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
  useSearchQueryBuilderConfig: () => ({
    getFieldDefinition: () => null,
  }),
  useSearchQueryBuilderLayout: () => ({
    size: 'normal',
  }),
}));

describe('FormattedQuery', () => {
  const defaultProps: Partial<FormattedQueryProps> = {
    filterKeys: FILTER_KEYS,
  };

  it('renders aggregate filters correctly', () => {
    render(<FormattedQuery {...defaultProps} query="count():>1" />);

    expect(screen.getByText(textWithMarkupMatcher('count() > 1'))).toBeInTheDocument();
  });

  it('renders filters with multiple values correctly', () => {
    render(<FormattedQuery {...defaultProps} query="browser.name:[Firefox,Chrome]" />);

    expect(
      screen.getByText(textWithMarkupMatcher('browser.name is Firefox or Chrome'))
    ).toBeInTheDocument();
  });

  it('renders negated filters with multiple values using and', () => {
    render(<FormattedQuery {...defaultProps} query="!browser.name:[Firefox,Chrome]" />);

    expect(
      screen.getByText(textWithMarkupMatcher('browser.name is not Firefox and Chrome'))
    ).toBeInTheDocument();
  });

  it('renders "is" filter correctly', () => {
    render(<FormattedQuery {...defaultProps} query="is:unresolved" />);

    expect(screen.getByText(textWithMarkupMatcher('is unresolved'))).toBeInTheDocument();
  });

  it('renders relative date filter correctly', () => {
    render(<FormattedQuery {...defaultProps} query="lastSeen:-7d" />);

    expect(
      screen.getByText(textWithMarkupMatcher('lastSeen is after 7d ago'))
    ).toBeInTheDocument();
  });

  it('renders absolute date filter correctly', () => {
    render(<FormattedQuery {...defaultProps} query="lastSeen:>2024-01-01" />);

    expect(
      screen.getByText(textWithMarkupMatcher('lastSeen is after Jan 1, 2024'))
    ).toBeInTheDocument();
  });

  it('renders boolean logic correctly', () => {
    render(<FormattedQuery {...defaultProps} query="(a OR b)" />);

    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-parenthesis')).toHaveLength(2);
  });

  it('renders explicit string tag correctly', () => {
    render(<FormattedQuery {...defaultProps} query="tags[foo,string]:bar" />);

    expect(screen.getByText(textWithMarkupMatcher('foo is bar'))).toBeInTheDocument();
  });

  it('renders explicit number tag correctly', () => {
    render(<FormattedQuery {...defaultProps} query="tags[foo,number]:<=100" />);

    expect(screen.getByText(textWithMarkupMatcher('foo is <=100'))).toBeInTheDocument();
  });

  it('renders has explicit string tag correctly', () => {
    render(<FormattedQuery {...defaultProps} query="has:tags[foo,string]" />);

    expect(screen.getByText(textWithMarkupMatcher('has foo'))).toBeInTheDocument();
  });

  it('renders has number string tag correctly', () => {
    render(<FormattedQuery {...defaultProps} query="has:tags[foo,number]" />);

    expect(screen.getByText(textWithMarkupMatcher('has foo'))).toBeInTheDocument();
  });

  it('renders an escaped asterisk with the escape visible', () => {
    render(<FormattedQuery {...defaultProps} query={'message:foo\\*bar'} />);

    expect(screen.getByText('foo\\*bar')).toBeInTheDocument();
  });

  it('renders a wildcard asterisk without an escape', () => {
    render(<FormattedQuery {...defaultProps} query="message:foo*bar" />);

    expect(screen.getByText('foo*bar')).toBeInTheDocument();
  });

  it('wraps filter values without wrapping keys and operators', () => {
    const query = `message:${'a'.repeat(400)}`;
    render(<FormattedQuery {...defaultProps} query={query} wrapTokens />);

    const value = screen.getByText('a'.repeat(400));
    const filter = value.parentElement!.parentElement!;

    expect(getEmotionRules(filter).join(' ')).toContain('white-space: nowrap');
    expect(getEmotionRules(value).join(' ')).toContain('white-space: normal');
    expect(getEmotionRules(value).join(' ')).toContain('overflow-wrap: anywhere');
  });

  it('middle-ellipsizes long path-like filter values', () => {
    const path = '/api/0/organizations/{organization_id_or_slug}/events/';
    render(<FormattedQuery {...defaultProps} query={`transaction:${path}`} />);

    expect(
      screen.getByText('/api/0…{organization_id_or_slug}/events/')
    ).toBeInTheDocument();
    expect(screen.queryByText(path)).not.toBeInTheDocument();
  });

  it('tightens and restores middle-ellipsis as available width changes', () => {
    const path = '/api/0/organizations/{organization_id_or_slug}/events/';
    const capped = '/api/0…{organization_id_or_slug}/events/';
    let clientWidth = 0;
    let resizeCallback: ResizeObserverCallback | undefined;

    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth'
    );
    const originalScrollWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollWidth'
    );
    const originalResizeObserver = window.ResizeObserver;

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return clientWidth;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        // Approximate: treat each character as 10px wide.
        return (this.textContent?.length ?? 0) * 10;
      },
    });
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    try {
      render(<FormattedQuery {...defaultProps} query={`transaction:${path}`} />);

      // clientWidth 0 → fall through to the character cap.
      expect(screen.getByText(capped)).toBeInTheDocument();

      clientWidth = 120;
      act(() => {
        resizeCallback?.([], {} as ResizeObserver);
      });

      expect(screen.getByText('/api…events/')).toBeInTheDocument();
      expect(screen.queryByText(capped)).not.toBeInTheDocument();

      clientWidth = 500;
      act(() => {
        resizeCallback?.([], {} as ResizeObserver);
      });

      expect(screen.getByText(capped)).toBeInTheDocument();
    } finally {
      window.ResizeObserver = originalResizeObserver;
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
      }
      if (originalScrollWidth) {
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
      }
    }
  });
});
