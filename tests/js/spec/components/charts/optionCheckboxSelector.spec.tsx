import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import OptionCheckboxSelector from 'app/components/charts/optionCheckboxSelector';
import {t} from 'app/locale';

describe('EventsV2 > OptionCheckboxSelector', function () {
  const features = ['discover-basic'];
  const yAxisValue = ['count()'];
  const yAxisOptions = [
    {label: 'count()', value: 'count()'},
    {label: 'failure_count()', value: 'failure_count()'},
    {label: 'count_unique(user)', value: 'count_unique(user)'},
  ];
  let organization, initialData, selected, wrapper, onChangeStub, dropdownItem;

  beforeEach(() => {
    // @ts-expect-error
    organization = TestStubs.Organization({
      features: [...features, 'connect-discover-and-dashboards'],
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
      <OptionCheckboxSelector
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

    dropdownItem = wrapper.find('StyledDropdownItem');
  });

  it('renders yAxisOptions with yAxisValue selected', function () {
    expect(dropdownItem.at(0).find('span').last().children().html()).toEqual('count()');
    expect(dropdownItem.at(1).find('span').last().children().html()).toEqual(
      'failure_count()'
    );
    expect(dropdownItem.at(2).find('span').last().children().html()).toEqual(
      'count_unique(user)'
    );
    expect(dropdownItem.at(0).props().isChecked).toEqual(true);
    expect(dropdownItem.at(1).props().isChecked).toEqual(false);
    expect(dropdownItem.at(2).props().isChecked).toEqual(false);
  });

  it('calls onChange prop with new checkbox option state', function () {
    wrapper.setProps({selected: ['failure_count()', 'count_unique(user)']});
    dropdownItem.at(2).find('span').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()']);
    dropdownItem.at(2).find('span').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()', 'count_unique(user)']);
    dropdownItem.at(1).find('span').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['count_unique(user)']);
    dropdownItem.at(1).find('span').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['count_unique(user)', 'failure_count()']);
    dropdownItem.at(1).find('span').first().simulate('click');
    dropdownItem.at(2).find('span').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith([]);
  });

  it('cannot select a Y-Axis field that is not compatible with already selected Y-Axis', function () {
    wrapper.setProps({selected: ['failure_count()', 'count_unique(user)']});
    dropdownItem.at(0).find('span').first().simulate('click');
    expect(onChangeStub).not.toHaveBeenCalled();
  });

  it('can select a Y-Axis with a different plot type if all Y-Axis were deselected', function () {
    dropdownItem.at(0).find('span').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith([]);
    dropdownItem.at(1).find('span').first().simulate('click');
    dropdownItem.at(2).find('span').first().simulate('click');
    expect(onChangeStub).toHaveBeenCalledWith(['failure_count()', 'count_unique(user)']);
  });
});
