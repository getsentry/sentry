import {LocationFixture} from 'sentry-fixture/locationFixture';
import {mockTraceItemAttributeKeysApi} from 'sentry-fixture/traceItemAttributeKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import type {Tag} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import AttributeField from 'sentry/views/settings/components/dataScrubbing/modals/form/attributeField';
import {AllowedDataScrubbingDatasets} from 'sentry/views/settings/components/dataScrubbing/types';

jest.mock('sentry/utils/useLocation');
const mockedUseLocation = jest.mocked(useLocation);

describe('AttributeField', () => {
  const {organization} = initializeOrg();
  const mockAttributeKeys: Tag[] = [
    {
      key: 'user.email',
      name: 'user.email',
      kind: FieldKind.TAG,
    },
    {
      key: 'user.id',
      name: 'user.id',
      kind: FieldKind.TAG,
    },
    {
      key: 'custom.field',
      name: 'custom.field',
      kind: FieldKind.TAG,
    },
    {
      key: 'request.method',
      name: 'request.method',
      kind: FieldKind.TAG,
    },
    {
      key: 'response.status',
      name: 'response.status',
      kind: FieldKind.TAG,
    },
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    mockedUseLocation.mockReturnValue(LocationFixture());

    // Setup the PageFilters store with default values
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: false,
      },
    });
  });

  it('default render', async () => {
    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);

    const value = 'user.email';
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value={value}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });
  });

  it('displays suggestions when input is focused', async () => {
    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);

    const value = '';
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value={value}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    // Wait for suggestions to load
    await screen.findByText('message');

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(screen.getByText('message')).toBeInTheDocument();
    expect(screen.getByText('user.email')).toBeInTheDocument();
  });

  it('filters suggestions based on input value', async () => {
    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);

    const value = 'user';
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value={value}
      />,
      {organization}
    );

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });

    // Wait for suggestions to load
    await screen.findByText('user.email');

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions).toHaveLength(2);
    expect(screen.getByText('user.email')).toBeInTheDocument();
    expect(screen.getByText('user.id')).toBeInTheDocument();
    expect(screen.queryByText('custom.field')).not.toBeInTheDocument();
  });

  it('calls onChange when suggestion is clicked', async () => {
    const handleOnChange = jest.fn();

    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);

    const value = '';
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={handleOnChange}
        value={value}
      />,
      {organization}
    );

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });

    // Wait for suggestions to load
    await screen.findByText('message');

    const suggestions = screen.getAllByRole('listitem');
    await userEvent.click(suggestions[1]!);

    expect(handleOnChange).toHaveBeenCalledWith('user.email');
  });

  it('handles keyboard navigation', async () => {
    const handleOnChange = jest.fn();
    const value = '';

    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={handleOnChange}
        value={value}
      />,
      {organization}
    );

    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });

    // Wait for suggestions to load
    await screen.findByText('message');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(handleOnChange).toHaveBeenCalledWith('user.id');
  });

  it('handles keyboard navigation with arrow up', async () => {
    const handleOnChange = jest.fn();
    const value = '';
    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={handleOnChange}
        value={value}
      />,
      {organization}
    );

    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });

    // Wait for suggestions to load
    await screen.findByText('message');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}');

    expect(handleOnChange).toHaveBeenCalledWith('user.email');
  });

  it('closes suggestions on escape key', async () => {
    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);
    const value = '';
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value={value}
      />,
      {organization}
    );

    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });

    // Wait for suggestions to load
    await screen.findByText('message');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('calls onBlur when input loses focus', async () => {
    const handleOnBlur = jest.fn();
    const value = 'test';
    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        onBlur={handleOnBlur}
        value={value}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });
    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.click(input);
    await userEvent.tab();

    expect(handleOnBlur).toHaveBeenCalledWith('test', expect.any(Object));
  });

  it('handles typing in input field', async () => {
    const handleOnChange = jest.fn();
    const value = '';
    mockTraceItemAttributeKeysApi(organization.slug, mockAttributeKeys);

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={handleOnChange}
        value={value}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });
    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.type(input, 'custom');

    expect(handleOnChange).toHaveBeenCalledWith('c');
    expect(handleOnChange).toHaveBeenCalledWith('u');
    expect(handleOnChange).toHaveBeenCalledWith('s');
    expect(handleOnChange).toHaveBeenCalledWith('t');
    expect(handleOnChange).toHaveBeenCalledWith('o');
    expect(handleOnChange).toHaveBeenCalledWith('m');
  });

  it('limits suggestions to 50 items', async () => {
    // Create many mock attributes
    const value = '';
    const manyAttributes: Tag[] = [];
    for (let i = 0; i < 100; i++) {
      manyAttributes.push({
        key: `attr${i}`,
        name: `attr${i}`,
        kind: FieldKind.TAG,
      });
    }

    mockTraceItemAttributeKeysApi(organization.slug, manyAttributes);

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value={value}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    await screen.findByText('message');

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions).toHaveLength(50);
  });

  it('filters out tag-based attributes using elideTagBasedAttributes', async () => {
    const value = '';
    const attributesWithTags: Tag[] = [
      {
        key: 'user.email',
        name: 'user.email',
        kind: FieldKind.TAG,
      },
      {
        key: 'tags[environment,string]',
        name: 'tags[environment,string]',
        kind: FieldKind.TAG,
      },
      {
        key: 'tags[id,string]',
        name: 'tags[id,string]',
        kind: FieldKind.TAG,
      },
      {
        key: 'tags[message,string]',
        name: 'tags[message,string]',
        kind: FieldKind.TAG,
      },
      {
        key: 'tags[project_id,string]',
        name: 'tags[project_id,string]',
        kind: FieldKind.TAG,
      },
      {
        key: 'custom.field',
        name: 'custom.field',
        kind: FieldKind.TAG,
      },
    ];

    MockApiClient.clearMockResponses();
    mockTraceItemAttributeKeysApi(organization.slug, attributesWithTags);

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value={value}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(value);
    });

    await screen.findByPlaceholderText('Select or type attribute');

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    await screen.findByText('message');

    const suggestions = screen.getAllByRole('listitem');
    const suggestionTexts = suggestions.map(item => item.textContent);

    // Should not contain any tags
    expect(suggestionTexts).toEqual(['message', 'user.email', 'custom.field']);
  });
});
