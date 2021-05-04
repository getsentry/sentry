import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventAttachments from 'app/components/events/eventAttachments';

describe('EventAttachments', function () {
  const {routerContext, organization, project} = initializeOrg();

  it('shows attachments limit reached notice', function () {
    const props = {
      orgId: organization.slug,
      projectId: project.slug,
      location: routerContext.context.location,
      event: TestStubs.Event({metadata: {stripped_crash: true}}),
    };

    const wrapper = mountWithTheme(<EventAttachments {...props} />);

    expect(wrapper.find('SectionHeader').text()).toBe('Attachments (0)');
    expect(wrapper.find('Link[data-test-id="attachmentsLink"]').prop('to')).toEqual({
      pathname: `/organizations/${props.orgId}/issues/1/attachments/`,
      query: {types: ['event.minidump', 'event.applecrashreport']},
    });
    expect(wrapper.find('Link[data-test-id="settingsLink"]').prop('to')).toBe(
      `/settings/${props.orgId}/projects/${props.projectId}/security-and-privacy/`
    );
    expect(wrapper.find('Alert').text()).toContain(
      'Your limit of stored crash reports has been reached for this issue.'
    );
  });

  it('does not render anything if no attachments (nor stripped) are available', function () {
    const props = {
      orgId: organization.slug,
      projectId: project.slug,
      location: routerContext.context.location,
      event: TestStubs.Event({metadata: {stripped_crash: false}}),
    };

    const wrapper = mountWithTheme(<EventAttachments {...props} />);

    expect(wrapper.isEmptyRender()).toBe(true);
  });
});
