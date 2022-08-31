import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventTags} from 'sentry/components/events/eventTags';

describe('event tags', function () {
  it('display redacted tags', async function () {
    const event = {
      ...TestStubs.Event(),
      tags: null,
      _meta: {
        tags: {'': {rem: [['project:2', 'x']]}},
      },
    };

    const {organization, project, router} = initializeOrg();

    render(
      <EventTags
        organization={organization}
        projectId={project.id}
        location={router.location}
        event={event}
      />
    );

    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText('Removed because of PII rule "project:2"')
    ).toBeInTheDocument(); // tooltip description
  });

  it('display redacted "app.device" tag', async function () {
    const tags = [
      {key: 'app.device', value: null},
      {key: 'device.family', value: 'iOS'},
    ];

    const event = {
      ...TestStubs.Event(),
      tags,
      _meta: {
        tags: {
          '0': {
            value: {
              '': {rem: [['project:2', 'x']]},
            },
          },
        },
      },
    };

    const {organization, project, router} = initializeOrg();

    render(
      <EventTags
        organization={organization}
        projectId={project.id}
        location={router.location}
        event={event}
      />
    );

    expect(screen.getByText('device.family')).toBeInTheDocument();
    expect(screen.getByText('iOS')).toBeInTheDocument();

    expect(screen.getByText('app.device')).toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText('Removed because of PII rule "project:2"')
    ).toBeInTheDocument(); // tooltip description
  });
});
