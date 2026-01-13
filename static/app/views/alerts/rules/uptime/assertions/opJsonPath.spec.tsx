import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {JsonPathOp} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionOpJsonPath} from './opJsonPath';

describe('AssertionOpJsonPath', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();

  const op = 'json_path' as const;

  const renderOp = (value: JsonPathOp) => {
    return render(
      <AssertionOpJsonPath
        value={value}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
      />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial value', () => {
    renderOp({id: 'test-id-1', op, value: '$.data.status'});

    expect(screen.getByRole('textbox')).toHaveValue('$.data.status');
  });

  it('renders with empty value', () => {
    renderOp({id: 'test-id-1', op, value: ''});

    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('shows placeholder text', () => {
    renderOp({id: 'test-id-1', op, value: ''});

    expect(screen.getByPlaceholderText("$[?(@.status == 'ok')]")).toBeInTheDocument();
  });

  it('calls onChange when value changes', async () => {
    renderOp({id: 'test-id-1', op, value: ''});

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'a');

    expect(mockOnChange).toHaveBeenCalledWith({
      id: 'test-id-1',
      op: 'json_path',
      value: 'a',
    });
  });

  it('calls onRemove when remove button is clicked', async () => {
    renderOp({id: 'test-id-1', op, value: '$.data.status'});

    await userEvent.click(screen.getByRole('button', {name: 'Remove assertion'}));

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('has tooltip with link to RFC', async () => {
    renderOp({id: 'test-id-1', op, value: "$[?(@.status == 'ok')]"});

    // Hover over the question mark icon to show tooltip
    const questionIcon = screen.getByTestId('more-information');
    await userEvent.hover(questionIcon);

    // Check that tooltip appears with the link
    const link = await screen.findByRole('link', {name: 'JSON Path RFC'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.rfc-editor.org/rfc/rfc9535.html');
  });
});
