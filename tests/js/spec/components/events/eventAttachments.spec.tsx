import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import EventAttachments from 'app/components/events/eventAttachments';

describe('EventAttachments', function () {
  const {routerContext, organization, project} = initializeOrg();
  // @ts-expect-error
  const event = TestStubs.Event({metadata: {stripped_crash: true}});

  const props = {
    orgId: organization.slug,
    projectId: project.slug,
    location: routerContext.context.location,
    attachments: [],
    onDeleteAttachment: jest.fn(),
    event,
  };

  it('shows attachments limit reached notice', function () {
    const {getByText, getByRole} = mountWithTheme(<EventAttachments {...props} />);

    expect(getByText('Attachments (0)')).toBeInTheDocument();

    expect(getByRole('link', {name: 'View crashes'})).toHaveAttribute('href', '');

    expect(getByRole('link', {name: 'configure limit'})).toHaveAttribute(
      'href',
      `/settings/${props.orgId}/projects/${props.projectId}/security-and-privacy/`
    );

    expect(
      getByText('Your limit of stored crash reports has been reached for this issue.')
    ).toBeInTheDocument();
  });

  it('does not render anything if no attachments (nor stripped) are available', function () {
    const {container} = mountWithTheme(
      <EventAttachments
        {...props}
        event={{...event, metadata: {stripped_crash: false}}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
