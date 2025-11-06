import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OptionSelector from 'sentry/components/charts/optionSelector';

describe('Charts > OptionSelector (Multiple)', () => {
  const yAxisValue = ['count()', 'failure_count()'];
  const yAxisOptions = [
    {label: 'count()', value: 'count()'},
    {label: 'failure_count()', value: 'failure_count()'},
    {label: 'count_unique(user)', value: 'count_unique(user)'},
    {label: 'avg(transaction.duration)', value: 'avg(transaction.duration)'},
  ];
  const onChangeStub = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  function TestComponent() {
    const [currentSelected, setCurrentSelected] = useState([...yAxisValue]);

    return (
      <OptionSelector
        multiple
        isOpen
        title="Y-Axis"
        selected={currentSelected}
        options={yAxisOptions}
        onChange={newSelected => {
          setCurrentSelected(newSelected);
          onChangeStub(newSelected);
        }}
      />
    );
  }

  const renderComponent = () => {
    return render(<TestComponent />);
  };

  it('renders yAxisOptions with yAxisValue selected', async () => {
    renderComponent();
    expect(await screen.findByRole('option', {name: 'count()'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'failure_count()'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'count_unique(user)'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('calls onChange prop with new checkbox option state', async () => {
    renderComponent();
    await userEvent.click(screen.getByRole('option', {name: 'count()'}));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
    onChangeStub.mockClear();
    await userEvent.click(screen.getByRole('option', {name: 'count()'}));
    expect(onChangeStub).toHaveBeenCalledWith(['count()', 'failure_count()']);
    onChangeStub.mockClear();
    await userEvent.click(screen.getByRole('option', {name: 'failure_count()'}));
    expect(onChangeStub).toHaveBeenCalledWith(['count()']);
    onChangeStub.mockClear();
    await userEvent.click(screen.getByRole('option', {name: 'failure_count()'}));
    expect(onChangeStub).toHaveBeenCalledWith(['count()', 'failure_count()']);
    onChangeStub.mockClear();
    await userEvent.click(screen.getByRole('option', {name: 'count_unique(user)'}));
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
  });

  it('does not uncheck options when clicked if only one option is currently selected', async () => {
    renderComponent();
    await userEvent.click(screen.getByRole('option', {name: 'count()'}));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
    await userEvent.click(screen.getByRole('option', {name: 'failure_count()'}));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
  });

  it('only allows up to 3 options to be checked at one time', async () => {
    renderComponent();
    await userEvent.click(screen.getByRole('option', {name: 'count_unique(user)'}));
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
    onChangeStub.mockClear();
    await userEvent.click(
      screen.getByRole('option', {name: 'avg(transaction.duration)'})
    );
    expect(onChangeStub).not.toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
      'avg(transaction.duration)',
    ]);
    onChangeStub.mockClear();
    await userEvent.click(screen.getByRole('option', {name: 'count_unique(user)'}));
    expect(onChangeStub).toHaveBeenCalledWith(['count()', 'failure_count()']);
    onChangeStub.mockClear();
    await userEvent.click(screen.getByRole('option', {name: 'count_unique(user)'}));
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
  });
});
