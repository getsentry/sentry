import {render} from 'sentry-test/reactTestingLibrary';

import AlertLink from 'sentry/components/alertLink';
import {IconMail} from 'sentry/icons';

describe('AlertLink', function () {
  it('renders', function () {
    render(
      <AlertLink to="/settings/accounts/notifications">
        This is an external link button
      </AlertLink>
    );
  });

  it('renders with icon', function () {
    render(
      <AlertLink to="/settings/accounts/notifications" icon={<IconMail />}>
        This is an external link button
      </AlertLink>
    );
  });
});
