import {act, render, screen} from 'sentry-test/reactTestingLibrary';
import {triggerResizeObservers} from 'sentry-test/resizeObserver';
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
    expect(screen.getByLabelText('OR')).toBeInTheDocument();
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

  it('middle-ellipsizes long path-like filter values', () => {
    const path = '/api/0/organizations/{organization_id_or_slug}/events/';
    render(<FormattedQuery {...defaultProps} query={`transaction:${path}`} />);

    expect(screen.getByText('/api/0…{organization_id_or_slug}/events/')).toHaveAttribute(
      'data-overflowing',
      'true'
    );
    expect(screen.queryByText(path)).not.toBeInTheDocument();
  });

  it('shows the full filter value when it fits beyond the fallback length', () => {
    const path = '/api/0/organizations/{organization_id_or_slug}/events/';
    const clientWidthSpy = jest
      .spyOn(Element.prototype, 'clientWidth', 'get')
      .mockReturnValue(1000);
    const scrollWidthSpy = jest
      .spyOn(Element.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: Element) {
        return (this.textContent?.length ?? 0) * 10 + 2;
      });

    try {
      render(<FormattedQuery {...defaultProps} query={`transaction:${path}`} />);

      expect(screen.getByText(path)).not.toHaveAttribute('data-overflowing');
    } finally {
      clientWidthSpy.mockRestore();
      scrollWidthSpy.mockRestore();
    }
  });

  it('preserves a short filter value that exactly fits its natural width', () => {
    const clientWidthSpy = jest
      .spyOn(Element.prototype, 'clientWidth', 'get')
      .mockReturnValue(102);
    const scrollWidthSpy = jest
      .spyOn(Element.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: Element) {
        // Approximate: treat each character as 10px wide, plus 2px end padding.
        return (this.textContent?.length ?? 0) * 10 + 2;
      });

    try {
      render(<FormattedQuery {...defaultProps} query="is:unresolved" />);

      expect(screen.getByText('unresolved')).toBeInTheDocument();
    } finally {
      clientWidthSpy.mockRestore();
      scrollWidthSpy.mockRestore();
    }
  });

  it('leaves room after a middle-ellipsis candidate for glyph rendering', () => {
    const clientWidthSpy = jest
      .spyOn(Element.prototype, 'clientWidth', 'get')
      .mockReturnValue(50);
    const scrollWidthSpy = jest
      .spyOn(Element.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: Element) {
        // Approximate: treat each character as 10px wide, plus 2px end padding.
        return (this.textContent?.length ?? 0) * 10 + 2;
      });

    try {
      render(<FormattedQuery {...defaultProps} query="transaction:foo/bar" />);

      const value = screen.getByText('…');
      expect(value).toHaveAttribute('data-overflowing', 'true');
      expect(value.scrollWidth).toBeLessThan(value.clientWidth);
    } finally {
      clientWidthSpy.mockRestore();
      scrollWidthSpy.mockRestore();
    }
  });

  it('does not let the temporary width lock collapse multi-value filters', () => {
    const clientWidthSpy = jest
      .spyOn(Element.prototype, 'clientWidth', 'get')
      .mockImplementation(function (this: Element) {
        return this instanceof HTMLElement && this.style.width ? 49 : 69;
      });
    const scrollWidthSpy = jest
      .spyOn(Element.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: Element) {
        // Approximate: treat each character as 10px wide, plus 2px end padding.
        return (this.textContent?.length ?? 0) * 10 + 2;
      });

    try {
      render(<FormattedQuery {...defaultProps} query="browser.name:[foo/bar,baz/qux]" />);

      expect(screen.getByText('foo…ar').scrollWidth).toBeLessThan(69);
      expect(screen.getByText('baz…ux').scrollWidth).toBeLessThan(69);
    } finally {
      clientWidthSpy.mockRestore();
      scrollWidthSpy.mockRestore();
    }
  });

  it('preserves distinguishing prefixes in truncated multi-value filters', () => {
    const clientWidthSpy = jest
      .spyOn(Element.prototype, 'clientWidth', 'get')
      .mockReturnValue(69);
    const scrollWidthSpy = jest
      .spyOn(Element.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: Element) {
        return (this.textContent?.length ?? 0) * 10 + 2;
      });

    try {
      render(
        <FormattedQuery
          {...defaultProps}
          query="browser.name:[/foo/shared,/bar/shared]"
        />
      );

      expect(screen.getByText('/fo…ed')).toHaveAttribute('data-overflowing', 'true');
      expect(screen.getByText('/ba…ed')).toHaveAttribute('data-overflowing', 'true');
    } finally {
      clientWidthSpy.mockRestore();
      scrollWidthSpy.mockRestore();
    }
  });

  it('tightens and restores middle-ellipsis as available width changes', () => {
    const path = '/api/0/organizations/{organization_id_or_slug}/events/';
    const capped = '/api/0…{organization_id_or_slug}/events/';
    render(<FormattedQuery {...defaultProps} query={`transaction:${path}`} />);

    // clientWidth 0 → fall through to the character cap.
    const element = screen.getByText(capped);
    let clientWidth = 120;
    Object.defineProperty(element, 'clientWidth', {
      configurable: true,
      get() {
        return clientWidth;
      },
    });
    Object.defineProperty(element, 'scrollWidth', {
      configurable: true,
      get() {
        // Approximate: treat each character as 10px wide, plus 2px end padding.
        return (this.textContent?.length ?? 0) * 10 + 2;
      },
    });

    act(triggerResizeObservers);

    expect(screen.getByText('…events/')).toBeInTheDocument();
    expect(screen.queryByText(capped)).not.toBeInTheDocument();

    clientWidth = 1000;
    act(triggerResizeObservers);

    expect(screen.getByText(path)).toBeInTheDocument();
  });
});
