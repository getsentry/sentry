import * as Storybook from 'sentry/stories';
import type {UserReport} from 'sentry/types/group';

import {EventUserFeedback} from './userFeedback';

const report: UserReport = {
  comments: 'The checkout button did nothing after I submitted payment.\nI tried twice.',
  dateCreated: '2024-01-01T00:00:00.000Z',
  email: 'jane@example.com',
  event: {eventID: 'abc123', id: '1'},
  eventID: 'abc123',
  id: '1',
  name: 'Jane Reporter',
  user: {
    avatarUrl: null,
    email: 'jane@example.com',
    id: '1',
    ipAddress: null,
    name: 'Jane Reporter',
    username: 'jane',
  },
};

export default Storybook.story('EventUserFeedback', story => {
  story('Default', () => (
    <div style={{maxWidth: 760}}>
      <EventUserFeedback
        report={report}
        eventLink="/organizations/org-slug/issues/123/events/abc123/?referrer=user-feedback"
      />
    </div>
  ));
});
