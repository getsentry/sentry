import {useState} from 'react';
import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {t} from 'sentry/locale';

describe('Charts > OptionSelector (Multiple)', function () {
  const features = ['discover-basic'];
  const yAxisValue = ['count()', 'failure_count()'];
  const yAxisOptions = [
    {label: 'count()', value: 'count()'},
    {label: 'failure_count()', value: 'failure_count()'},
    {label: 'count_unique(user)', value: 'count_unique(user)'},
    {label: 'avg(transaction.duration)', value: 'avg(transaction.duration)'},
  ];
  const onChangeStub = jest.fn();
  const organization = Organization({
    features: [...features],
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function TestComponent() {
    const [currentSelected, setCurrentSelected] = useState([...yAxisValue]);

    return (
      <OptionSelector
        multiple
        isOpen
        title={t('Y-Axis')}
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
    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      projects: [],
    });

    return render(<TestComponent />, {context: initialData.routerContext});
  };

  it('renders yAxisOptions with yAxisValue selected', function () {
    renderComponent();
    expect(screen.getByRole('option', {name: 'count()'})).toHaveAttribute(
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

  it('calls onChange prop with new checkbox option state', async function () {
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

  it('does not uncheck options when clicked if only one option is currently selected', async function () {
    renderComponent();
    await userEvent.click(screen.getByRole('option', {name: 'count()'}));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
    await userEvent.click(screen.getByRole('option', {name: 'failure_count()'}));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
  });

  it('only allows up to 3 options to be checked at one time', async function () {
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
