import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import EventCause from 'app/components/events/eventCause';

describe('EventCause', function () {
  const event = TestStubs.Event();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();

  const context = {
    organization,
    project,
    group: TestStubs.Group(),
  };

  afterEach(function () {
    Client.clearMockResponses();
  });

  beforeEach(function () {
    Client.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [
          {
            author: {name: 'Max Bittker', id: '1'},
            commits: [
              {
                message:
                  'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
                score: 4,
                id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
                repository: TestStubs.Repository(),
                dateCreated: '2018-03-02T18:30:26Z',
              },
              {
                message:
                  'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
                score: 4,
                id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
                repository: TestStubs.Repository(),
                dateCreated: '2018-03-02T18:30:26Z',
              },
            ],
          },
          {
            author: {name: 'Somebody else', id: '2'},
            commits: [
              {
                message: 'fix: Make things less broken',
                score: 2,
                id: 'zzzzzz3d0c9000829084ac7b1c9221fb18437c',
                repository: TestStubs.Repository(),
                dateCreated: '2018-03-02T16:30:26Z',
              },
            ],
          },
        ],
      },
    });
  });

  it('renders', async function () {
    const wrapper = mountWithTheme(
      <EventCause event={event} orgId={organization.slug} projectId={project.slug} />,
      {
        context,
      }
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('CommitRow')).toHaveLength(1);
    expect(wrapper.find('EmailWarningIcon').exists()).toBe(false);
    expect(wrapper.find('Hovercard').exists()).toBe(false);
  });

  it('expands', async function () {
    const wrapper = mountWithTheme(
      <EventCause event={event} orgId={organization.slug} projectId={project.slug} />,
      {
        context,
      }
    );

    await tick();
    wrapper.update();

    wrapper.find('ExpandButton').simulate('click');
    await tick();
    expect(wrapper.find('CommitRow')).toHaveLength(2);

    // and hides
    wrapper.find('ExpandButton').simulate('click');
    await tick();
    expect(wrapper.find('CommitRow')).toHaveLength(1);
  });

  it('shows unassociated email warning', async function () {
    Client.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [
          {
            author: {name: 'Somebody else', email: 'somebodyelse@email.com'},
            commits: [
              {
                message: 'fix: Make things less broken',
                score: 2,
                id: 'zzzzzz3d0c9000829084ac7b1c9221fb18437c',
                repository: TestStubs.Repository(),
                dateCreated: '2018-03-02T16:30:26Z',
              },
            ],
          },
        ],
      },
    });

    const wrapper = mountWithTheme(
      <EventCause event={event} orgId={organization.slug} projectId={project.slug} />,
      {
        context,
      }
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('CommitRow')).toHaveLength(1);
    expect(wrapper.find('EmailWarningIcon').exists()).toBe(true);
    expect(wrapper.find('Hovercard').exists()).toBe(true);
  });
});
