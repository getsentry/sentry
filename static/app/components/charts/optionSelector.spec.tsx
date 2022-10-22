import {useState} from 'react';
import {Organization} from 'fixtures/js-stubs/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {t} from 'sentry/locale';

describe('EventsV2 > OptionSelector (Multiple)', function () {
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

  const TestComponent = () => {
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
  };

  const renderComponent = () => {
    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });

    return render(<TestComponent />, {context: initialData.routerContext});
  };

  it('renders yAxisOptions with yAxisValue selected', function () {
    renderComponent();
    expect(
      within(screen.getByTestId('count()')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('failure_count()')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();
    expect(
      // eslint-disable-next-line testing-library/prefer-presence-queries
      within(screen.getByTestId('count_unique(user)')).queryByTestId('icon-check-mark')
    ).not.toBeInTheDocument();
  });

  it('calls onChange prop with new checkbox option state', function () {
    renderComponent();
    userEvent.click(screen.getByTestId('count()'));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
    onChangeStub.mockClear();
    userEvent.click(screen.getByTestId('count()'));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()', 'count()']);
    onChangeStub.mockClear();
    userEvent.click(screen.getByTestId('failure_count()'));
    expect(onChangeStub).toHaveBeenCalledWith(['count()']);
    onChangeStub.mockClear();
    userEvent.click(screen.getByTestId('failure_count()'));
    expect(onChangeStub).toHaveBeenCalledWith(['count()', 'failure_count()']);
    onChangeStub.mockClear();
    userEvent.click(screen.getByTestId('count_unique(user)'));
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
  });

  it('does not uncheck options when clicked if only one option is currently selected', function () {
    renderComponent();
    userEvent.click(screen.getByTestId('count()'));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
    userEvent.click(screen.getByTestId('failure_count()'));
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
  });

  it('only allows up to 3 options to be checked at one time', function () {
    renderComponent();
    userEvent.click(screen.getByTestId('count_unique(user)'));
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
    onChangeStub.mockClear();
    userEvent.click(screen.getByTestId('avg(transaction.duration)'));
    expect(onChangeStub).not.toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
      'avg(transaction.duration)',
    ]);
    onChangeStub.mockClear();
    userEvent.click(screen.getByTestId('count_unique(user)'));
    expect(onChangeStub).toHaveBeenCalledWith(['count()', 'failure_count()']);
    onChangeStub.mockClear();
    userEvent.click(screen.getByTestId('count_unique(user)'));
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
  });
});
