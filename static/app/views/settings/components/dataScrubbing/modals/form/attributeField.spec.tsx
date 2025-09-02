import {createMockAttributeResults} from 'sentry-fixture/log';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import AttributeField from 'sentry/views/settings/components/dataScrubbing/modals/form/attributeField';
import {AllowedDataScrubbingDatasets} from 'sentry/views/settings/components/dataScrubbing/types';

jest.mock('sentry/views/explore/hooks/useTraceItemAttributeKeys');

const mockUseTraceItemAttributeKeys = jest.mocked(useTraceItemAttributeKeys);

describe('AttributeField', () => {
  const mockAttributeResults = createMockAttributeResults();

  beforeEach(() => {
    const logsResult = mockAttributeResults[AllowedDataScrubbingDatasets.LOGS];
    if (logsResult) {
      mockUseTraceItemAttributeKeys.mockReturnValue(logsResult);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('default render', () => {
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value="user.email"
      />
    );

    expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue(
      'user.email'
    );
  });

  it('displays suggestions when input is focused', async () => {
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value=""
      />
    );

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(screen.getByText('message')).toBeInTheDocument();
    expect(screen.getByText('user.email')).toBeInTheDocument();
  });

  it('filters suggestions based on input value', async () => {
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value="user"
      />
    );

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions).toHaveLength(2);
    expect(screen.getByText('user.email')).toBeInTheDocument();
    expect(screen.getByText('user.id')).toBeInTheDocument();
    expect(screen.queryByText('custom.field')).not.toBeInTheDocument();
  });

  it('calls onChange when suggestion is clicked', async () => {
    const handleOnChange = jest.fn();

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={handleOnChange}
        value=""
      />
    );

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    const suggestions = screen.getAllByRole('listitem');
    await userEvent.click(suggestions[1]!);

    expect(handleOnChange).toHaveBeenCalledWith('user.email');
  });

  it('handles keyboard navigation', async () => {
    const handleOnChange = jest.fn();

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={handleOnChange}
        value=""
      />
    );

    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.click(input);

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(handleOnChange).toHaveBeenCalledWith('user.id');
  });

  it('handles keyboard navigation with arrow up', async () => {
    const handleOnChange = jest.fn();

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={handleOnChange}
        value=""
      />
    );

    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.click(input);

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}');

    expect(handleOnChange).toHaveBeenCalledWith('user.email');
  });

  it('closes suggestions on escape key', async () => {
    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value=""
      />
    );

    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.click(input);

    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('calls onBlur when input loses focus', async () => {
    const handleOnBlur = jest.fn();

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        onBlur={handleOnBlur}
        value="test"
      />
    );

    const input = screen.getByPlaceholderText('Select or type attribute');
    await userEvent.click(input);
    await userEvent.tab();

    expect(handleOnBlur).toHaveBeenCalledWith('test', expect.any(Object));
  });

  it('handles typing in input field', async () => {
    const handleOnChange = jest.fn();

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={handleOnChange}
        value=""
      />
    );

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
    const manyAttributes: Record<string, any> = {};
    for (let i = 0; i < 100; i++) {
      manyAttributes[`attr${i}`] = {
        key: `attr${i}`,
        name: `attr${i}`,
        kind: 'TAG',
      };
    }

    mockUseTraceItemAttributeKeys.mockReturnValue({
      attributes: manyAttributes,
      isLoading: false,
      error: null,
    });

    render(
      <AttributeField
        dataset={AllowedDataScrubbingDatasets.LOGS}
        onChange={jest.fn()}
        value=""
      />
    );

    await userEvent.click(screen.getByPlaceholderText('Select or type attribute'));

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions).toHaveLength(50);
  });
});
