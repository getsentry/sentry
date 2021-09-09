import {fireEvent, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import Banner from 'app/components/banner';

describe('Banner', function () {
  it('can be dismissed', function () {
    const wrapper = mountWithTheme(<Banner dismissKey="test" title="test" />);
    expect(wrapper.getByText('test')).toBeInTheDocument();

    fireEvent.click(wrapper.getByLabelText('Close'));

    expect(wrapper.queryByText('test')).toBeNull();
    expect(localStorage.getItem('test-banner-dismissed')).toBe('true');
  });

  it('is not dismissable', function () {
    const wrapper = mountWithTheme(<Banner isDismissable={false} />);
    expect(wrapper.queryByLabelText('Close')).toBeNull();
  });
});
