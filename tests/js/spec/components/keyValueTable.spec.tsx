import {mountWithTheme} from 'sentry-test/enzyme';

import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';

describe('KeyValueTable', function () {
  it('basic', function () {
    const wrapper = mountWithTheme(
      <KeyValueTable>
        <KeyValueTableRow keyName="Coffee" value="Black hot drink" />
        <KeyValueTableRow keyName="Milk" value={<a href="#">White cold drink</a>} />
      </KeyValueTable>
    );

    expect(wrapper.find('dl').exists()).toBeTruthy();
    expect(wrapper.find('dt').at(0).text()).toBe('Coffee');
    expect(wrapper.find('dd').at(0).text()).toBe('Black hot drink');
    expect(wrapper.find('dt').at(1).text()).toBe('Milk');
    expect(wrapper.find('dd a').text()).toBe('White cold drink');
  });
});
