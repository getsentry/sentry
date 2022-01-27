import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import AlertLink from 'sentry/components/alertLink';
import {IconMail} from 'sentry/icons';

describe('AlertLink', function () {
  it('renders', function () {
    const {container} = mountWithTheme(
      <AlertLink to="/settings/accounts/notifications">
        This is an external link button
      </AlertLink>
    );
    expect(container).toSnapshot();
  });

  it('renders with icon', function () {
    const {container} = mountWithTheme(
      <AlertLink to="/settings/accounts/notifications" icon={<IconMail />}>
        This is an external link button
      </AlertLink>
    );
    expect(container).toSnapshot();
  });
});
