import {mountWithTheme} from 'sentry-test/enzyme';

import Conditions from 'app/views/discover/conditions';

describe('Conditions', function () {
  let wrapper, onChangeMock, conditions;
  beforeEach(function () {
    conditions = [
      ['col1', 'IS NOT NULL', null],
      ['col2', '=', 2],
    ];
    onChangeMock = jest.fn();
    const columns = [
      {name: 'col1', type: 'string'},
      {name: 'col2', type: 'number'},
    ];
    const value = [];
    wrapper = mountWithTheme(
      <Conditions columns={columns} onChange={onChangeMock} value={value} />,
      TestStubs.routerContext()
    );
  });
  describe('render()', function () {
    it('renders conditions', function () {
      wrapper.setProps({value: conditions});
      expect(wrapper.find('ConditionRow')).toHaveLength(2);
    });

    it('renders empty text if no conditions', function () {
      expect(wrapper.text()).toContain('None, showing all events');
    });
  });

  it('addRow()', function () {
    wrapper
      .find('AddText')
      .find("[data-test-id='conditions-add-text-link']")
      .hostNodes()
      .simulate('click');
    expect(onChangeMock).toHaveBeenCalledWith([[null, null, null]]);
  });

  it('removeRow()', function () {
    wrapper.setProps({value: conditions});
    wrapper.instance().removeRow(1);
    expect(onChangeMock).toHaveBeenCalledWith([conditions[0]]);
  });

  it('handleChange', function () {
    wrapper.setProps({value: conditions});
    wrapper.instance().handleChange(['col1', 'IS NULL', null], 0);
    expect(onChangeMock).toHaveBeenCalledWith([['col1', 'IS NULL', null], conditions[1]]);
  });
});
