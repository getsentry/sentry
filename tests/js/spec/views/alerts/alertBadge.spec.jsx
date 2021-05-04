import {mountWithTheme} from 'sentry-test/enzyme';

import AlertBadge from 'app/views/alerts/alertBadge';
import {IncidentStatus} from 'app/views/alerts/types';

describe('AlertBadge', function () {
  it('displays status', function () {
    const wrapper = mountWithTheme(<AlertBadge status={IncidentStatus.CLOSED} />);
    expect(wrapper.text()).toBe('Resolved');
  });
  it('hides status text', function () {
    const wrapper = mountWithTheme(
      <AlertBadge hideText status={IncidentStatus.CLOSED} />
    );
    expect(wrapper.text()).toBe('');
  });
  it('can be an issue badge', function () {
    const wrapper = mountWithTheme(<AlertBadge hideText isIssue />);
    expect(wrapper.text()).toBe('');
  });
});
