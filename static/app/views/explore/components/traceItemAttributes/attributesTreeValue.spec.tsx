import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {AttributesTreeValue} from 'sentry/views/explore/components/traceItemAttributes/attributesTreeValue';

jest.mock('sentry/actionCreators/modal', () => ({
  openNavigateToExternalLinkModal: jest.fn(),
}));

describe('AttributesTreeValue', function () {
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

  it('returns null when originalAttribute is missing', function () {
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

  it('renders with custom renderer when available', function () {
    const customRenderer = () => <div>Custom Rendered Content</div>;
    const renderers = {
      'test.key': customRenderer,
    };

    render(<AttributesTreeValue {...defaultProps} renderers={renderers} />);

    expect(screen.getByText('Custom Rendered Content')).toBeInTheDocument();
    expect(screen.queryByText('test-value')).not.toBeInTheDocument();
  });

  it('renders URL value as a link with correct destination', function () {
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

  it('renders URL value as plain string when rich values are disabled', function () {
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

  it('calls openNavigateToExternalLinkModal when URL link is clicked', function () {
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

  it('renders non-URL values as plain spans', function () {
    render(<AttributesTreeValue {...defaultProps} />);

    expect(screen.getByText('test-value')).toBeInTheDocument();
  });

  it('handles null values correctly', function () {
    const nullContent = {
      ...defaultProps.content,
      value: null,
    };

    render(<AttributesTreeValue {...defaultProps} content={nullContent} />);

    expect(screen.getByText('null')).toBeInTheDocument();
  });
});
