import {mountWithTheme} from 'sentry-test/enzyme';

import SizeSelector from 'app/views/dashboardsV2/sizeSelector';

describe('Dashboards > SizeSelector', function () {
  it('triggers the onSizeChange callback with the selected value when changed', async function () {
    const mock = jest.fn(val => val);
    const wrapper = mountWithTheme(<SizeSelector size="medium" onSizeChange={mock} />);

    expect(wrapper.text()).toContain('Medium');

    wrapper.find('Select').props().onChange({value: 'small'});
    expect(mock).toHaveBeenCalledWith('small');
  });
});
