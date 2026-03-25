import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {AttributesTreeValue} from 'sentry/views/explore/components/traceItemAttributes/attributesTreeValue';

jest.mock('sentry/actionCreators/modal', () => ({
  openNavigateToExternalLinkModal: jest.fn(),
}));

describe('AttributesTreeValue', () => {
  const organization = OrganizationFixture();
  const location = LocationFixture();
  const theme = ThemeFixture();

  const defaultProps = {
    content: {
      subtree: {},
      value: 'test-value',
      originalAttribute: {
        attribute_key: 'test.key',
        attribute_value: 'test-value',
        original_attribute_key: 'test.key',
      },
    },
    rendererExtra: {
      organization,
      location,
      theme,
    },
    theme,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when originalAttribute is missing', () => {
    const {container} = render(
      <AttributesTreeValue
        {...defaultProps}
        content={{
          subtree: {},
          value: 'test-value',
          originalAttribute: undefined,
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders with custom renderer when available', () => {
    const customRenderer = () => <div>Custom Rendered Content</div>;
    const renderers = {
      'test.key': customRenderer,
    };

    render(<AttributesTreeValue {...defaultProps} renderers={renderers} />);

    expect(screen.getByText('Custom Rendered Content')).toBeInTheDocument();
    expect(screen.queryByText('test-value')).not.toBeInTheDocument();
  });

  it('renders URL value as a link with correct destination', () => {
    const urlContent = {
      ...defaultProps.content,
      value: 'https://example.com',
    };

    render(<AttributesTreeValue {...defaultProps} content={urlContent} />);

    const link = screen.getByText('https://example.com').closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('renders URL value as plain string when rich values are disabled', () => {
    const urlContent = {
      ...defaultProps.content,
      value: 'https://example.com',
    };

    render(
      <AttributesTreeValue
        {...defaultProps}
        content={urlContent}
        config={{disableRichValue: true}}
      />
    );

    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('calls openNavigateToExternalLinkModal when URL link is clicked', () => {
    const urlContent = {
      ...defaultProps.content,
      value: 'https://example.com',
    };

    render(<AttributesTreeValue {...defaultProps} content={urlContent} />);

    const $link = screen.getByText('https://example.com').closest('a')!;
    $link.click();

    expect(openNavigateToExternalLinkModal).toHaveBeenCalledWith({
      linkText: 'https://example.com',
    });
  });

  it('renders non-URL values as plain spans', () => {
    render(<AttributesTreeValue {...defaultProps} />);

    expect(screen.getByText('test-value')).toBeInTheDocument();
  });

  it('handles null values correctly', () => {
    const nullContent = {
      ...defaultProps.content,
      value: null,
    };

    render(<AttributesTreeValue {...defaultProps} content={nullContent} />);

    expect(screen.getByText('null')).toBeInTheDocument();
  });

  it('renders JSON object values as structured data', () => {
    const jsonContent = {
      ...defaultProps.content,
      value: '{"key": "value", "number": 42}',
    };

    render(<AttributesTreeValue {...defaultProps} content={jsonContent} />);

    expect(screen.getByText('key')).toBeInTheDocument();
    expect(screen.getByText('value')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders JSON array values as structured data', () => {
    const jsonContent = {
      ...defaultProps.content,
      value: '[1, 2, 3]',
    };

    render(<AttributesTreeValue {...defaultProps} content={jsonContent} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders invalid JSON containing braces as plain text', () => {
    const invalidJsonContent = {
      ...defaultProps.content,
      value: 'not {json',
    };

    render(<AttributesTreeValue {...defaultProps} content={invalidJsonContent} />);

    expect(screen.getByText('not {json')).toBeInTheDocument();
  });

  it('renders plain strings without braces as plain text', () => {
    const plainContent = {
      ...defaultProps.content,
      value: 'hello world',
    };

    render(<AttributesTreeValue {...defaultProps} content={plainContent} />);

    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('does not render JSON as structured data when disableRichValue is true', () => {
    const jsonContent = {
      ...defaultProps.content,
      value: '{"key": "value"}',
    };

    render(
      <AttributesTreeValue
        {...defaultProps}
        content={jsonContent}
        config={{disableRichValue: true}}
      />
    );

    expect(screen.getByText('{"key": "value"}')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders simple JSON with compact class', () => {
    const jsonContent = {
      ...defaultProps.content,
      value: '{"boop": "bop"}',
    };

    render(<AttributesTreeValue {...defaultProps} content={jsonContent} />);

    const pre = screen.getByText('bop').closest('pre');
    expect(pre).toHaveClass('compact');
  });

  it('renders long JSON without compact class', () => {
    const jsonContent = {
      ...defaultProps.content,
      value: '{"k": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}',
    };

    render(<AttributesTreeValue {...defaultProps} content={jsonContent} />);

    const pre = screen
      .getByText('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      .closest('pre');
    expect(pre).not.toHaveClass('compact');
  });
});
