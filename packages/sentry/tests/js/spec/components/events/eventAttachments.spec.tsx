import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventAttachments from 'sentry/components/events/eventAttachments';

describe('EventAttachments', function () {
  const {routerContext, organization, project} = initializeOrg();
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
    render(<EventAttachments {...props} />);

    expect(screen.getByText('Attachments (0)')).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'View crashes'})).toHaveAttribute('href', '');

    expect(screen.getByRole('link', {name: 'configure limit'})).toHaveAttribute(
      'href',
      `/settings/${props.orgId}/projects/${props.projectId}/security-and-privacy/`
    );

    expect(
      screen.getByText(
        'Your limit of stored crash reports has been reached for this issue.'
      )
    ).toBeInTheDocument();
  });

  it('does not render anything if no attachments (nor stripped) are available', function () {
    const {container} = render(
      <EventAttachments
        {...props}
        event={{...event, metadata: {stripped_crash: false}}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
