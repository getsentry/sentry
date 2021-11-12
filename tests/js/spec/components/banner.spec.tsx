import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Banner from 'app/components/banner';

describe('Banner', function () {
  it('can be dismissed', function () {
    mountWithTheme(<Banner dismissKey="test" title="test" />);
    expect(screen.getByText('test')).toBeInTheDocument();

    userEvent.click(screen.getByLabelText('Close'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();
    expect(localStorage.getItem('test-banner-dismissed')).toBe('true');
  });

  it('is not dismissable', function () {
    mountWithTheme(<Banner isDismissable={false} />);
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });
});
