import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

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
  let organization, initialData, selected, wrapper, onChangeStub, dropdownItem;

  beforeEach(() => {
    organization = TestStubs.Organization({
      features: [...features],
    });

    // Start off with an invalid view (empty is invalid)
    initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });
    selected = [...yAxisValue];
    wrapper = mountWithTheme(
      <OptionSelector
        multiple
        isOpen
        title={t('Y-Axis')}
        selected={selected}
        options={yAxisOptions}
        onChange={() => undefined}
      />,
      initialData.routerContext
    );
    // Parent component usually handles the new selected state but we don't have one in this test so we update props ourselves
    onChangeStub = jest.fn(newSelected => wrapper.setProps({selected: newSelected}));
    wrapper.setProps({onChange: onChangeStub});

    dropdownItem = wrapper.find('SelectOption');
  });

  it('renders yAxisOptions with yAxisValue selected', function () {
    expect(dropdownItem.at(0).find('span').last().children().html()).toEqual('count()');
    expect(dropdownItem.at(1).find('span').last().children().html()).toEqual(
      'failure_count()'
    );
    expect(dropdownItem.at(2).find('span').last().children().html()).toEqual(
      'count_unique(user)'
    );
    expect(dropdownItem.at(0).props().isSelected).toEqual(true);
    expect(dropdownItem.at(1).props().isSelected).toEqual(true);
    expect(dropdownItem.at(2).props().isSelected).toEqual(false);
  });

  it('calls onChange prop with new checkbox option state', function () {
    dropdownItem.at(0).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
    dropdownItem.at(0).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()', 'count()']);
    dropdownItem.at(1).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['count()']);
    dropdownItem.at(1).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['count()', 'failure_count()']);
    dropdownItem.at(2).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
  });

  it('does not uncheck options when clicked if only one option is currently selected', function () {
    dropdownItem.at(0).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
    dropdownItem.at(1).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
  });

  it('only allows up to 3 options to be checked at one time', function () {
    dropdownItem.at(2).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
    dropdownItem.at(3).find('div').first().simulate('click');
    expect(onChangeStub).not.toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
      'avg(transaction.duration)',
    ]);
    dropdownItem.at(2).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['count()', 'failure_count()']);
    dropdownItem.at(3).find('div').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith([
      'count()',
      'failure_count()',
      'count_unique(user)',
    ]);
  });
});
