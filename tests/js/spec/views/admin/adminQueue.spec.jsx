import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AdminQueue from 'app/views/admin/adminQueue';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminQueue', function () {
  describe('render()', function () {
    beforeEach(() => {
      Client.addMockResponse({
        url: '/internal/queue/tasks/',
        body: [
          'celery.backend_cleanup',
          'celery.chain',
          'celery.chord',
          'celery.chord_unlock',
          'celery.chunks',
          'celery.group',
          'celery.map',
          'celery.starmap',
          'sentry.celery.SentryTask',
          'sentry.tasks.activity.send_activity_notifications',
          'sentry.tasks.clear_expired_resolutions',
          'sentry.tasks.commits.fetch_commits',
          'sentry.tasks.deletion.delete_api_application',
          'sentry.tasks.deletion.delete_group',
          'sentry.tasks.deletion.delete_organization',
          'sentry.tasks.deletion.delete_project',
          'sentry.tasks.deletion.delete_repository',
          'sentry.tasks.deletion.delete_team',
          'sentry.tasks.deletion.generic_delete',
          'sentry.tasks.deletion.revoke_api_tokens',
          'sentry.tasks.deletion.run_deletion',
          'sentry.tasks.deletion.run_scheduled_deletions',
          'sentry.tasks.digests.deliver_digest',
          'sentry.tasks.digests.schedule_digests',
          'sentry.tasks.email.process_inbound_email',
          'sentry.tasks.email.send_email',
          'sentry.tasks.email_unlink_notifications',
          'sentry.tasks.merge.merge_group',
          'sentry.tasks.merge.rehash_group_events',
          'sentry.tasks.post_process.plugin_post_process_group',
          'sentry.tasks.post_process.post_process_group',
          'sentry.tasks.process_buffer.process_incr',
          'sentry.tasks.process_buffer.process_pending',
          'sentry.tasks.send_sso_link_emails',
          'sentry.tasks.store.preprocess_event',
          'sentry.tasks.store.preprocess_event_from_reprocessing',
          'sentry.tasks.store.process_event',
          'sentry.tasks.store.process_event_from_reprocessing',
          'sentry.tasks.store.save_event',
          'sentry.tasks.unmerge',
        ],
      });
    });

    it('renders', function () {
      const wrapper = mountWithTheme(<AdminQueue params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });
      expect(wrapper).toSnapshot();
    });
  });
});
