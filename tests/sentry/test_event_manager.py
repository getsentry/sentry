# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import logging
import mock
import pytest
import uuid

from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from time import time

from sentry.app import tsdb
from sentry.constants import MAX_CULPRIT_LENGTH, DEFAULT_LOGGER_NAME, VERSION_LENGTH
from sentry.event_manager import (
    HashDiscarded, EventManager, EventUser, InvalidTimestamp,
    get_hashes_for_event, get_hashes_from_fingerprint, generate_culprit,
    md5_from_hash, process_timestamp
)
from sentry.models import (
    Activity, Environment, Event, Group, GroupEnvironment, GroupHash, GroupRelease, GroupResolution,
    GroupStatus, GroupTombstone, EventMapping, Release
)
from sentry.signals import event_discarded, event_saved
from sentry.testutils import assert_mock_called_once_with_partial, TestCase, TransactionTestCase


class EventManagerTest(TransactionTestCase):
    def make_event(self, **kwargs):
        result = {
            'event_id': 'a' * 32,
            'message': 'foo',
            'timestamp': 1403007314.570599,
            'level': logging.ERROR,
            'logger': 'default',
            'tags': [],
        }
        result.update(kwargs)
        return result

    def test_key_id_remains_in_data(self):
        manager = EventManager(self.make_event(key_id=12345))
        manager.normalize()
        assert manager.data['key_id'] == 12345
        event = manager.save(1)
        assert event.data['key_id'] == 12345

    def test_similar_message_prefix_doesnt_group(self):
        # we had a regression which caused the default hash to just be
        # 'event.message' instead of '[event.message]' which caused it to
        # generate a hash per letter
        manager = EventManager(self.make_event(message='foo bar'))
        manager.normalize()
        event1 = manager.save(1)

        manager = EventManager(self.make_event(message='foo baz'))
        manager.normalize()
        event2 = manager.save(1)

        assert event1.group_id != event2.group_id

    def test_transaction_over_culprit(self):
        manager = EventManager(self.make_event(
            culprit='foo',
            transaction='bar'
        ))
        manager.normalize()
        event1 = manager.save(1)

        assert event1.transaction == 'bar'
        assert event1.culprit == 'bar'

    @mock.patch('sentry.signals.regression_signal.send')
    def test_broken_regression_signal(self, send):
        send.side_effect = Exception()

        manager = EventManager(self.make_event())
        event = manager.save(1)

        assert event.message == 'foo'
        assert event.project_id == 1

    @mock.patch('sentry.event_manager.should_sample')
    def test_saves_event_mapping_when_sampled(self, should_sample):
        should_sample.return_value = True
        event_id = 'a' * 32

        manager = EventManager(self.make_event(event_id=event_id))
        event = manager.save(1)

        # This is a brand new event, so it is actually saved.
        # In this case, we don't need an EventMapping, but we
        # do need the Event.
        assert not EventMapping.objects.filter(
            group_id=event.group_id,
            event_id=event_id,
        ).exists()

        assert Event.objects.filter(
            event_id=event_id,
        ).exists()

        event_id = 'b' * 32

        manager = EventManager(self.make_event(event_id=event_id))
        event = manager.save(1)

        # This second is a dupe, so should be sampled
        # For a sample, we want to store the EventMapping,
        # but don't need to store the Event
        assert EventMapping.objects.filter(
            group_id=event.group_id,
            event_id=event_id,
        ).exists()

        assert not Event.objects.filter(
            event_id=event_id,
        ).exists()

    @mock.patch('sentry.event_manager.should_sample')
    def test_sample_feature_flag(self, should_sample):
        should_sample.return_value = True

        manager = EventManager(self.make_event())
        with self.feature('projects:sample-events'):
            event = manager.save(1)
        assert event.id

        manager = EventManager(self.make_event())
        with self.feature({'projects:sample-events': False}):
            event = manager.save(1)
        assert not event.id

    def test_tags_as_list(self):
        manager = EventManager(self.make_event(tags=[('foo', 'bar')]))
        data = manager.normalize()

        assert data['tags'] == [('foo', 'bar')]

    def test_tags_as_dict(self):
        manager = EventManager(self.make_event(tags={'foo': 'bar'}))
        data = manager.normalize()

        assert data['tags'] == [('foo', 'bar')]

    def test_interface_is_relabeled(self):
        manager = EventManager(self.make_event(user={'id': '1'}))
        data = manager.normalize()

        assert data['sentry.interfaces.User'] == {'id': '1'}
        assert 'user' not in data

    def test_does_default_ip_address_to_user(self):
        manager = EventManager(
            self.make_event(
                **{
                    'sentry.interfaces.Http': {
                        'url': 'http://example.com',
                        'env': {
                            'REMOTE_ADDR': '127.0.0.1',
                        }
                    }
                }
            )
        )
        data = manager.normalize()
        assert data['sentry.interfaces.User']['ip_address'] == '127.0.0.1'

    def test_does_default_ip_address_if_present(self):
        manager = EventManager(
            self.make_event(
                **{
                    'sentry.interfaces.Http': {
                        'url': 'http://example.com',
                        'env': {
                            'REMOTE_ADDR': '127.0.0.1',
                        }
                    },
                    'sentry.interfaces.User': {
                        'ip_address': '192.168.0.1',
                    },
                }
            )
        )
        data = manager.normalize()
        assert data['sentry.interfaces.User']['ip_address'] == '192.168.0.1'

    def test_does_not_default_invalid_ip_address(self):
        manager = EventManager(
            self.make_event(
                **{
                    'sentry.interfaces.Http': {
                        'url': 'http://example.com',
                        'env': {
                            'REMOTE_ADDR': '127.0.0.1, 192.168.0.1',
                        }
                    }
                }
            )
        )
        data = manager.normalize()
        assert 'sentry.interfaces.User' not in data

    def test_platform_is_saved(self):
        manager = EventManager(
            self.make_event(
                **{'sentry.interfaces.AppleCrashReport': {
                    'crash': {},
                    'binary_images': []
                }}
            )
        )
        manager.normalize()
        event = manager.save(1)

        assert 'sentry.interfacse.AppleCrashReport' not in event.interfaces

    def test_ephemral_interfaces_removed_on_save(self):
        manager = EventManager(self.make_event(platform='python'))
        event = manager.save(1)

        group = event.group
        assert group.platform == 'python'
        assert event.platform == 'python'

    def test_dupe_message_id(self):
        event_id = 'a' * 32

        manager = EventManager(self.make_event(event_id=event_id))
        manager.save(1)

        assert Event.objects.count() == 1

        # ensure that calling it again doesn't raise a db error
        manager = EventManager(self.make_event(event_id=event_id))
        manager.save(1)

        assert Event.objects.count() == 1

    def test_updates_group(self):
        manager = EventManager(
            self.make_event(
                message='foo',
                event_id='a' * 32,
                checksum='a' * 32,
            )
        )
        event = manager.save(1)

        manager = EventManager(
            self.make_event(
                message='foo bar',
                event_id='b' * 32,
                checksum='a' * 32,
            )
        )
        with self.tasks():
            event2 = manager.save(1)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen.replace(microsecond=0) == event.datetime.replace(microsecond=0)
        assert group.message == event2.message
        assert group.data.get('type') == 'default'
        assert group.data.get('metadata') == {
            'title': 'foo bar',
        }

    def test_updates_group_with_fingerprint(self):
        manager = EventManager(
            self.make_event(
                message='foo',
                event_id='a' * 32,
                fingerprint=['a' * 32],
            )
        )
        with self.tasks():
            event = manager.save(1)

        manager = EventManager(
            self.make_event(
                message='foo bar',
                event_id='b' * 32,
                fingerprint=['a' * 32],
            )
        )
        with self.tasks():
            event2 = manager.save(1)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen.replace(microsecond=0) == event.datetime.replace(microsecond=0)
        assert group.message == event2.message

    def test_differentiates_with_fingerprint(self):
        manager = EventManager(
            self.make_event(
                message='foo',
                event_id='a' * 32,
                fingerprint=['{{ default }}', 'a' * 32],
            )
        )
        with self.tasks():
            manager.normalize()
            event = manager.save(1)

        manager = EventManager(
            self.make_event(
                message='foo bar',
                event_id='b' * 32,
                fingerprint=['a' * 32],
            )
        )
        with self.tasks():
            manager.normalize()
            event2 = manager.save(1)

        assert event.group_id != event2.group_id

    def test_unresolves_group(self):
        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1. MySQL doesn't support microseconds.
        manager = EventManager(
            self.make_event(
                event_id='a' * 32,
                checksum='a' * 32,
                timestamp=1403007314,
            )
        )
        with self.tasks():
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(
            self.make_event(
                event_id='b' * 32,
                checksum='a' * 32,
                timestamp=1403007345,
            )
        )
        event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert not group.is_resolved()

    @mock.patch('sentry.event_manager.plugin_is_regression')
    def test_does_not_unresolve_group(self, plugin_is_regression):
        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1. MySQL doesn't support microseconds.
        plugin_is_regression.return_value = False

        manager = EventManager(
            self.make_event(
                event_id='a' * 32,
                checksum='a' * 32,
                timestamp=1403007314,
            )
        )
        with self.tasks():
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(
            self.make_event(
                event_id='b' * 32,
                checksum='a' * 32,
                timestamp=1403007315,
            )
        )
        event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert group.is_resolved()

    @mock.patch('sentry.tasks.activity.send_activity_notifications.delay')
    @mock.patch('sentry.event_manager.plugin_is_regression')
    def test_marks_as_unresolved_with_new_release(
        self, plugin_is_regression, mock_send_activity_notifications_delay
    ):
        plugin_is_regression.return_value = True

        old_release = Release.objects.create(
            version='a',
            organization_id=self.project.organization_id,
            date_added=timezone.now() - timedelta(minutes=30),
        )
        old_release.add_project(self.project)

        manager = EventManager(
            self.make_event(
                event_id='a' * 32,
                checksum='a' * 32,
                timestamp=time() - 50000,  # need to work around active_at
                release=old_release.version,
            )
        )
        event = manager.save(1)

        group = event.group

        group.update(status=GroupStatus.RESOLVED)

        resolution = GroupResolution.objects.create(
            release=old_release,
            group=group,
        )
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.SET_RESOLVED_IN_RELEASE,
            ident=resolution.id,
            data={'version': ''},
        )

        manager = EventManager(
            self.make_event(
                event_id='b' * 32,
                checksum='a' * 32,
                timestamp=time(),
                release=old_release.version,
            )
        )
        event = manager.save(1)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data['version'] == ''

        assert GroupResolution.objects.filter(group=group).exists()

        manager = EventManager(
            self.make_event(
                event_id='c' * 32,
                checksum='a' * 32,
                timestamp=time(),
                release='b',
            )
        )
        event = manager.save(1)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data['version'] == 'b'

        assert not GroupResolution.objects.filter(group=group).exists()

        activity = Activity.objects.get(
            group=group,
            type=Activity.SET_REGRESSION,
        )

        mock_send_activity_notifications_delay.assert_called_once_with(activity.id)

    @mock.patch('sentry.models.Group.is_resolved')
    def test_unresolves_group_with_auto_resolve(self, mock_is_resolved):
        mock_is_resolved.return_value = False
        manager = EventManager(
            self.make_event(
                event_id='a' * 32,
                checksum='a' * 32,
                timestamp=1403007314,
            )
        )
        with self.tasks():
            event = manager.save(1)

        mock_is_resolved.return_value = True
        manager = EventManager(
            self.make_event(
                event_id='b' * 32,
                checksum='a' * 32,
                timestamp=1403007414,
            )
        )
        with self.tasks():
            event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group.id)
        assert group.active_at == event2.datetime != event.datetime

    def test_long_culprit(self):
        manager = EventManager(self.make_event(
            culprit='x' * (MAX_CULPRIT_LENGTH + 1),
        ))
        data = manager.normalize()
        assert len(data['culprit']) == MAX_CULPRIT_LENGTH

    def test_long_transaction(self):
        manager = EventManager(self.make_event(
            transaction='x' * (MAX_CULPRIT_LENGTH + 1),
        ))
        data = manager.normalize()
        assert len(data['transaction']) == MAX_CULPRIT_LENGTH

    def test_long_message(self):
        manager = EventManager(
            self.make_event(
                message='x' * (settings.SENTRY_MAX_MESSAGE_LENGTH + 1),
            )
        )
        data = manager.normalize()
        assert len(data['sentry.interfaces.Message']['message']) == \
            settings.SENTRY_MAX_MESSAGE_LENGTH

    def test_default_version(self):
        manager = EventManager(self.make_event())
        data = manager.normalize()
        assert data['version'] == '5'

    def test_explicit_version(self):
        manager = EventManager(self.make_event(), '6')
        data = manager.normalize()
        assert data['version'] == '6'

    def test_first_release(self):
        manager = EventManager(self.make_event(release='1.0'))
        event = manager.save(1)

        group = event.group
        assert group.first_release.version == '1.0'

        manager = EventManager(self.make_event(release='2.0'))
        event = manager.save(1)

        group = event.group
        assert group.first_release.version == '1.0'

    def test_release_project_slug(self):
        project = self.create_project(name='foo')
        release = Release.objects.create(version='foo-1.0', organization=project.organization)
        release.add_project(project)

        manager = EventManager(self.make_event(release='1.0'))
        event = manager.save(project.id)

        group = event.group
        assert group.first_release.version == 'foo-1.0'
        release_tag = [v for k, v in event.tags if k == 'sentry:release'][0]
        assert release_tag == 'foo-1.0'

        manager = EventManager(self.make_event(release='2.0'))
        event = manager.save(project.id)

        group = event.group
        assert group.first_release.version == 'foo-1.0'

    def test_release_project_slug_long(self):
        project = self.create_project(name='foo')
        release = Release.objects.create(
            version='foo-%s' % ('a' * (VERSION_LENGTH - 4), ), organization=project.organization
        )
        release.add_project(project)

        manager = EventManager(self.make_event(release=('a' * (VERSION_LENGTH - 3))))
        event = manager.save(project.id)

        group = event.group
        assert group.first_release.version == 'foo-%s' % ('a' * (VERSION_LENGTH - 4), )
        release_tag = [v for k, v in event.tags if k == 'sentry:release'][0]
        assert release_tag == 'foo-%s' % ('a' * (VERSION_LENGTH - 4), )

    def test_group_release_no_env(self):
        manager = EventManager(self.make_event(release='1.0'))
        event = manager.save(1)

        release = Release.objects.get(version='1.0', projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id,
            group_id=event.group_id,
            environment='',
        ).exists()

        # ensure we're not erroring on second creation
        manager = EventManager(self.make_event(release='1.0'))
        manager.save(1)

    def test_group_release_with_env(self):
        manager = EventManager(
            self.make_event(release='1.0', environment='prod', event_id='a' * 32)
        )
        event = manager.save(1)

        release = Release.objects.get(version='1.0', projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id,
            group_id=event.group_id,
            environment='prod',
        ).exists()

        manager = EventManager(
            self.make_event(release='1.0', environment='staging', event_id='b' * 32)
        )
        event = manager.save(1)

        release = Release.objects.get(version='1.0', projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id,
            group_id=event.group_id,
            environment='staging',
        ).exists()

    def test_logger(self):
        manager = EventManager(self.make_event(logger="foo\nbar"))
        data = manager.normalize()
        assert data['logger'] == DEFAULT_LOGGER_NAME

        manager = EventManager(self.make_event(logger=""))
        data = manager.normalize()
        assert data['logger'] == DEFAULT_LOGGER_NAME
        assert not any(e.get('name') == 'logger' for e in data['errors'])

    def test_tsdb(self):
        project = self.project
        manager = EventManager(self.make_event(
            fingerprint=['totally unique super duper fingerprint'],
            environment='totally unique super duper environment',
        ))
        event = manager.save(project)

        def query(model, key, **kwargs):
            return tsdb.get_sums(model, [key], event.datetime, event.datetime, **kwargs)[key]

        assert query(tsdb.models.project, project.id) == 1
        assert query(tsdb.models.group, event.group.id) == 1

        environment_id = Environment.get_for_organization_id(
            event.project.organization_id,
            'totally unique super duper environment',
        ).id
        assert query(tsdb.models.project, project.id, environment_id=environment_id) == 1
        assert query(tsdb.models.group, event.group.id, environment_id=environment_id) == 1

    @pytest.mark.xfail
    def test_record_frequencies(self):
        project = self.project
        manager = EventManager(self.make_event())
        event = manager.save(project)

        assert tsdb.get_most_frequent(
            tsdb.models.frequent_issues_by_project,
            (event.project.id, ),
            event.datetime,
        ) == {
            event.project.id: [
                (event.group_id, 1.0),
            ],
        }

        assert tsdb.get_most_frequent(
            tsdb.models.frequent_projects_by_organization,
            (event.project.organization_id, ),
            event.datetime,
        ) == {
            event.project.organization_id: [
                (event.project_id, 1.0),
            ],
        }

    def test_event_user(self):
        manager = EventManager(self.make_event(
            environment='totally unique environment',
            **{'sentry.interfaces.User': {
                'id': '1',
            }}
        ))
        manager.normalize()
        with self.tasks():
            event = manager.save(self.project.id)

        environment_id = Environment.get_for_organization_id(
            event.project.organization_id,
            'totally unique environment',
        ).id

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_group,
            (event.group.id, ),
            event.datetime,
            event.datetime,
        ) == {
            event.group.id: 1,
        }

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_project,
            (event.project.id, ),
            event.datetime,
            event.datetime,
        ) == {
            event.project.id: 1,
        }

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_group,
            (event.group.id, ),
            event.datetime,
            event.datetime,
            environment_id=environment_id,
        ) == {
            event.group.id: 1,
        }

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_project,
            (event.project.id, ),
            event.datetime,
            event.datetime,
            environment_id=environment_id,
        ) == {
            event.project.id: 1,
        }

        euser = EventUser.objects.get(
            project_id=self.project.id,
            ident='1',
        )
        assert event.get_tag('sentry:user') == euser.tag_value

        # ensure event user is mapped to tags in second attempt
        manager = EventManager(
            self.make_event(**{'sentry.interfaces.User': {
                'id': '1',
                'name': 'jane',
            }})
        )
        manager.normalize()
        with self.tasks():
            event = manager.save(self.project.id)

        euser = EventUser.objects.get(id=euser.id)
        assert event.get_tag('sentry:user') == euser.tag_value
        assert euser.name == 'jane'
        assert euser.ident == '1'

    def test_event_user_unicode_identifier(self):
        manager = EventManager(self.make_event(**{'sentry.interfaces.User': {'username': u'foô'}}))
        manager.normalize()
        with self.tasks():
            manager.save(self.project.id)
        euser = EventUser.objects.get(
            project_id=self.project.id,
        )
        assert euser.username == u'foô'

    def test_environment(self):
        manager = EventManager(self.make_event(**{
            'environment': 'beta',
        }))
        manager.normalize()
        event = manager.save(self.project.id)

        assert dict(event.tags).get('environment') == 'beta'

    @mock.patch('sentry.event_manager.post_process_group.delay')
    def test_group_environment(self, mock_post_process_group_delay):
        def save_event():
            manager = EventManager(self.make_event(**{
                'event_id': uuid.uuid1().hex,  # don't deduplicate
                'environment': 'beta',
            }))
            manager.normalize()
            return manager.save(self.project.id)

        event = save_event()

        # Ensure the `GroupEnvironment` record was created.
        GroupEnvironment.objects.get(
            group_id=event.group_id,
            environment_id=Environment.objects.get(
                organization_id=self.project.organization_id,
                name=event.get_tag('environment'),
            ).id,
        )

        # Ensure that the first event in the (group, environment) pair is
        # marked as being part of a new environment.
        mock_post_process_group_delay.assert_called_with(
            group=event.group,
            event=event,
            is_new=True,
            is_sample=False,
            is_regression=False,
            is_new_group_environment=True,
        )

        event = save_event()

        # Ensure that the next event in the (group, environment) pair is *not*
        # marked as being part of a new environment.
        mock_post_process_group_delay.assert_called_with(
            group=event.group,
            event=event,
            is_new=False,
            is_sample=False,
            is_regression=None,  # XXX: wut
            is_new_group_environment=False,
        )

    def test_default_fingerprint(self):
        manager = EventManager(self.make_event())
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.data.get('fingerprint') == ['{{ default }}']

    def test_default_event_type(self):
        manager = EventManager(self.make_event(message='foo bar'))
        data = manager.normalize()
        assert data['type'] == 'default'
        event = manager.save(self.project.id)
        group = event.group
        assert group.data.get('type') == 'default'
        assert group.data.get('metadata') == {
            'title': 'foo bar',
        }

    def test_message_event_type(self):
        manager = EventManager(
            self.make_event(
                **{
                    'message': '',
                    'sentry.interfaces.Message': {
                        'formatted': 'foo bar',
                        'message': 'foo %s',
                        'params': ['bar'],
                    }
                }
            )
        )
        data = manager.normalize()
        assert data['type'] == 'default'
        event = manager.save(self.project.id)
        group = event.group
        assert group.data.get('type') == 'default'
        assert group.data.get('metadata') == {
            'title': 'foo bar',
        }

    def test_error_event_type(self):
        manager = EventManager(
            self.make_event(
                **{
                    'sentry.interfaces.Exception': {
                        'values': [{
                            'type': 'Foo',
                            'value': 'bar',
                        }],
                    },
                }
            )
        )
        data = manager.normalize()
        assert data['type'] == 'error'
        event = manager.save(self.project.id)
        group = event.group
        assert group.data.get('type') == 'error'
        assert group.data.get('metadata') == {
            'type': 'Foo',
            'value': 'bar',
        }

    def test_csp_event_type(self):
        manager = EventManager(
            self.make_event(
                **{
                    'sentry.interfaces.Csp': {
                        'effective_directive': 'script-src',
                        'blocked_uri': 'http://example.com',
                    },
                }
            )
        )
        data = manager.normalize()
        assert data['type'] == 'csp'
        event = manager.save(self.project.id)
        group = event.group
        assert group.data.get('type') == 'csp'
        assert group.data.get('metadata') == {
            'directive': 'script-src',
            'uri': 'example.com',
            'message': "Blocked 'script' from 'example.com'",
        }

    def test_sdk(self):
        manager = EventManager(
            self.make_event(**{
                'sdk': {
                    'name': 'sentry-unity',
                    'version': '1.0',
                },
            })
        )
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.data['sdk'] == {
            'name': 'sentry-unity',
            'version': '1.0',
        }

    def test_no_message(self):
        # test that the message is handled gracefully
        manager = EventManager(
            self.make_event(
                **{
                    'message': None,
                    'sentry.interfaces.Message': {
                        'message': 'hello world',
                    },
                }
            )
        )
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.message == 'hello world'

    def test_bad_message(self):
        # test that the message is handled gracefully
        manager = EventManager(self.make_event(**{
            'message': 1234,
        }))
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.message == '1234'
        assert event.data['sentry.interfaces.Message'] == {
            'message': '1234',
        }

    def test_message_attribute_goes_to_interface(self):
        manager = EventManager(self.make_event(**{
            'message': 'hello world',
        }))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.data['sentry.interfaces.Message'] == {
            'message': 'hello world',
        }

    def test_message_attribute_goes_to_formatted(self):
        # The combining of 'message' and 'sentry.interfaces.Message' is a bit
        # of a compatibility hack, and ideally we would just enforce a stricter
        # schema instead of combining them like this.
        manager = EventManager(
            self.make_event(
                **{
                    'message': 'world hello',
                    'sentry.interfaces.Message': {
                        'message': 'hello world',
                    },
                }
            )
        )
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.data['sentry.interfaces.Message'] == {
            'message': 'hello world',
            'formatted': 'world hello',
        }

    def test_message_attribute_interface_both_strings(self):
        manager = EventManager(
            self.make_event(
                **{
                    'sentry.interfaces.Message': 'a plain string',
                    'message': 'another string',
                }
            )
        )
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.data['sentry.interfaces.Message'] == {
            'message': 'a plain string',
            'formatted': 'another string',
        }

    def test_throws_when_matches_discarded_hash(self):
        manager = EventManager(
            self.make_event(
                message='foo',
                event_id='a' * 32,
                fingerprint=['a' * 32],
            )
        )
        with self.tasks():
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        tombstone = GroupTombstone.objects.create(
            project_id=group.project_id,
            level=group.level,
            message=group.message,
            culprit=group.culprit,
            data=group.data,
            previous_group_id=group.id,
        )
        GroupHash.objects.filter(
            group=group,
        ).update(
            group=None,
            group_tombstone_id=tombstone.id,
        )

        manager = EventManager(
            self.make_event(
                message='foo',
                event_id='a' * 32,
                fingerprint=['a' * 32],
            )
        )

        mock_event_discarded = mock.Mock()
        event_discarded.connect(mock_event_discarded)
        mock_event_saved = mock.Mock()
        event_saved.connect(mock_event_saved)

        with self.tasks():
            with self.assertRaises(HashDiscarded):
                event = manager.save(1)

        assert not mock_event_saved.called
        assert_mock_called_once_with_partial(
            mock_event_discarded,
            project=group.project,
            sender=EventManager,
            signal=event_discarded,
        )

    def test_event_saved_signal(self):
        mock_event_saved = mock.Mock()
        event_saved.connect(mock_event_saved)

        manager = EventManager(self.make_event(message='foo'))
        manager.normalize()
        event = manager.save(1)

        assert_mock_called_once_with_partial(
            mock_event_saved,
            project=event.group.project,
            sender=EventManager,
            signal=event_saved,
        )

    def test_bad_interfaces_no_exception(self):
        manager = EventManager(
            self.make_event(
                **{
                    'sentry.interfaces.User': None,
                    'sentry.interfaces.Http': None,
                    'sdk': 'A string for sdk is not valid'
                }
            )
        )
        manager.normalize({'client_ip': '1.2.3.4'})

        manager = EventManager(
            self.make_event(
                **{
                    'errors': {},
                    'sentry.interfaces.Http': {},
                }
            )
        )
        manager.normalize()


class ProcessTimestampTest(TestCase):
    def test_iso_timestamp(self):
        self.assertEquals(
            process_timestamp(
                '2012-01-01T10:30:45',
                current_datetime=datetime(2012, 1, 1, 10, 30, 45),
            ),
            1325413845.0,
        )

    def test_iso_timestamp_with_ms(self):
        self.assertEquals(
            process_timestamp(
                '2012-01-01T10:30:45.434',
                current_datetime=datetime(2012, 1, 1, 10, 30, 45, 434000),
            ),
            1325413845.0,
        )

    def test_timestamp_iso_timestamp_with_Z(self):
        self.assertEquals(
            process_timestamp(
                '2012-01-01T10:30:45Z',
                current_datetime=datetime(2012, 1, 1, 10, 30, 45),
            ),
            1325413845.0,
        )

    def test_invalid_timestamp(self):
        self.assertRaises(InvalidTimestamp, process_timestamp, 'foo')

    def test_invalid_numeric_timestamp(self):
        self.assertRaises(InvalidTimestamp, process_timestamp, '100000000000000000000.0')

    def test_future_timestamp(self):
        self.assertRaises(InvalidTimestamp, process_timestamp, '2052-01-01T10:30:45Z')

    def test_long_microseconds_value(self):
        self.assertEquals(
            process_timestamp(
                '2012-01-01T10:30:45.341324Z',
                current_datetime=datetime(2012, 1, 1, 10, 30, 45),
            ),
            1325413845.0,
        )


class GetHashesFromEventTest(TestCase):
    @mock.patch('sentry.interfaces.stacktrace.Stacktrace.compute_hashes')
    @mock.patch('sentry.interfaces.http.Http.compute_hashes')
    def test_stacktrace_wins_over_http(self, http_comp_hash, stack_comp_hash):
        # this was a regression, and a very important one
        http_comp_hash.return_value = [['baz']]
        stack_comp_hash.return_value = [['foo', 'bar']]
        event = Event(
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'lineno': 1,
                        'filename': 'foo.py',
                    }],
                },
                'sentry.interfaces.Http': {
                    'url': 'http://example.com'
                },
            },
            platform='python',
            message='Foo bar',
        )
        hashes = get_hashes_for_event(event)
        assert len(hashes) == 1
        hash_one = hashes[0]
        stack_comp_hash.assert_called_once_with('python')
        assert not http_comp_hash.called
        assert hash_one == ['foo', 'bar']


class GetHashesFromFingerprintTest(TestCase):
    def test_default_value(self):
        event = Event(
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [
                        {
                            'lineno': 1,
                            'filename': 'foo.py',
                        }, {
                            'lineno': 1,
                            'filename': 'foo.py',
                            'in_app': True,
                        }
                    ],
                },
                'sentry.interfaces.Http': {
                    'url': 'http://example.com'
                },
            },
            platform='python',
            message='Foo bar',
        )
        fp_checksums = get_hashes_from_fingerprint(event, ["{{default}}"])
        def_checksums = get_hashes_for_event(event)
        assert def_checksums == fp_checksums

    def test_custom_values(self):
        event = Event(
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [
                        {
                            'lineno': 1,
                            'filename': 'foo.py',
                        }, {
                            'lineno': 1,
                            'filename': 'foo.py',
                            'in_app': True,
                        }
                    ],
                },
                'sentry.interfaces.Http': {
                    'url': 'http://example.com'
                },
            },
            platform='python',
            message='Foo bar',
        )
        fp_checksums = get_hashes_from_fingerprint(event, ["{{default}}", "custom"])
        def_checksums = get_hashes_for_event(event)
        assert len(fp_checksums) == len(def_checksums)
        assert def_checksums != fp_checksums


class GenerateCulpritTest(TestCase):
    def test_with_exception_interface(self):
        data = {
            'sentry.interfaces.Exception': {
                'values': [
                    {
                        'stacktrace': {
                            'frames': [
                                {
                                    'lineno': 1,
                                    'filename': 'foo.py',
                                }, {
                                    'lineno': 1,
                                    'filename': 'bar.py',
                                    'in_app': True,
                                }
                            ],
                        }
                    }
                ]
            },
            'sentry.interfaces.Stacktrace': {
                'frames': [
                    {
                        'lineno': 1,
                        'filename': 'NOTME.py',
                    }, {
                        'lineno': 1,
                        'filename': 'PLZNOTME.py',
                        'in_app': True,
                    }
                ],
            },
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        }
        assert generate_culprit(data) == 'bar.py in ?'

    def test_with_missing_exception_interface(self):
        data = {
            'sentry.interfaces.Stacktrace': {
                'frames': [
                    {
                        'lineno': 1,
                        'filename': 'NOTME.py',
                    }, {
                        'lineno': 1,
                        'filename': 'PLZNOTME.py',
                        'in_app': True,
                    }
                ],
            },
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        }
        assert generate_culprit(data) == 'PLZNOTME.py in ?'

    def test_with_empty_stacktrace(self):
        data = {
            'sentry.interfaces.Stacktrace': None,
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        }
        assert generate_culprit(data) == 'http://example.com'

    def test_with_only_http_interface(self):
        data = {
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        }
        assert generate_culprit(data) == 'http://example.com'

        data = {
            'sentry.interfaces.Http': {},
        }
        assert generate_culprit(data) == ''

    def test_empty_data(self):
        assert generate_culprit({}) == ''

    def test_truncation(self):
        data = {
            'sentry.interfaces.Exception': {
                'values':
                [{
                    'stacktrace': {
                        'frames': [{
                            'filename': 'x' * (MAX_CULPRIT_LENGTH + 1),
                        }],
                    }
                }],
            }
        }
        assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH

        data = {
            'sentry.interfaces.Stacktrace': {
                'frames': [{
                    'filename': 'x' * (MAX_CULPRIT_LENGTH + 1),
                }]
            }
        }
        assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH

        data = {
            'sentry.interfaces.Http': {
                'url': 'x' * (MAX_CULPRIT_LENGTH + 1),
            }
        }
        assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH

    def test_md5_from_hash(self):
        result = md5_from_hash(['foo', 'bar', u'foô'])
        assert result == '6d81588029ed4190110b2779ba952a00'
