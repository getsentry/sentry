import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import EventCause from 'app/components/events/eventCause';

describe('EventCause', function() {
  let wrapper, organization, project, event;

  afterEach(function() {
    Client.clearMockResponses();
  });

  beforeEach(function() {
    event = TestStubs.Event();
    organization = TestStubs.Organization();
    project = TestStubs.Project();
    Client.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: {
          commits: [
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
      },
    });

    wrapper = mount(
      <EventCause event={event} orgId={organization.slug} projectId={project.slug} />,
      {
        context: {
          organization,
          project,
          group: TestStubs.Group(),
        },
      }
    );
  });

  it('renders', function(done) {
    wrapper.update();

    setTimeout(() => {
      expect(wrapper.find('.commit-list').children).toHaveLength(1);
      done();
    });
  });
});
