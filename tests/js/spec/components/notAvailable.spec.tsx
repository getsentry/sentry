import {mountWithTheme} from 'sentry-test/enzyme';

import NotAvailable from 'app/components/notAvailable';

describe('NotAvailable', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(<NotAvailable />);
    expect(wrapper.text()).toEqual('\u2014');
  });

  it('renders with tooltip', function () {
    const wrapper = mountWithTheme(<NotAvailable tooltip="Tooltip text" />);
    expect(wrapper.text()).toEqual('\u2014');
    expect(wrapper.find('Tooltip').prop('title')).toBe('Tooltip text');
  });
});
