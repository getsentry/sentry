import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Organization, SharedViewOrganization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';

import {SharedEventContent} from './sharedEventContent';

describe('SharedEventContent', () => {
  const organization: SharedViewOrganization = {slug: 'test-org', features: []};
  const project = ProjectFixture();
  const group = GroupFixture();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes native thread entries through the public renderer with limited organization context', async () => {
    const stacktrace = {
      ...EventEntryStacktraceFixture().data,
      frames: [
        FrameFixture({
          platform: 'cocoa',
          function: 'causeCrash',
          rawFunction: null,
          module: null,
        }),
      ],
    };
    const request = jest.spyOn(MockApiClient.prototype, 'request');
    render(
      <OrganizationContext value={organization as Organization}>
        <SharedEventContent
          organization={organization}
          project={project}
          group={group}
          event={EventFixture({
            platform: 'cocoa',
            entries: [
              {
                type: 'exception',
                data: {
                  values: [
                    {
                      type: 'EXC_BAD_ACCESS',
                      value: 'invalid address',
                      module: null,
                      mechanism: null,
                      threadId: 1,
                      rawStacktrace: null,
                      stacktrace,
                    },
                  ],
                },
              },
              {
                type: 'threads',
                data: {
                  values: [
                    {
                      id: 1,
                      crashed: true,
                      current: true,
                      stacktrace,
                      rawStacktrace: null,
                    },
                  ],
                },
              },
            ],
          })}
        />
      </OrganizationContext>
    );

    expect(await screen.findByTestId('native-stack-trace-frame-title')).toHaveTextContent(
      'causeCrash'
    );
    expect(screen.getAllByRole('heading', {name: 'EXC_BAD_ACCESS'})).toHaveLength(1);
    expect(request).not.toHaveBeenCalled();
  });

  it('renders event entries', () => {
    render(
      <SharedEventContent
        organization={organization}
        project={project}
        group={group}
        event={EventFixture({
          entries: [EventEntryFixture()],
        })}
      />
    );

    expect(screen.getByText(/message/i)).toBeInTheDocument();
  });

  it('renders latest event not available when no event', () => {
    render(
      <SharedEventContent
        organization={organization}
        project={project}
        group={group}
        event={undefined}
      />
    );

    expect(screen.getByText('Latest Event Not Available')).toBeInTheDocument();
  });

  it('renders user feedback when present', () => {
    render(
      <SharedEventContent
        organization={organization}
        project={project}
        group={group}
        event={EventFixture({
          userReport: {
            comments: 'This is broken!',
            dateCreated: '2024-01-01',
            email: 'user@example.com',
            eventID: '1',
            id: '1',
            issue: null,
            name: 'Test User',
            user: null,
          },
          entries: [],
        })}
      />
    );

    expect(screen.getByText('This is broken!')).toBeInTheDocument();
  });
});
