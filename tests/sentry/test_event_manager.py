# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import logging

from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from mock import patch
from time import time

from sentry.app import tsdb
from sentry.constants import MAX_CULPRIT_LENGTH, DEFAULT_LOGGER_NAME
from sentry.event_manager import (
    EventManager, EventUser, get_hashes_for_event, get_hashes_from_fingerprint,
    generate_culprit,
)
from sentry.models import (
    Activity, Event, Group, GroupResolution, GroupStatus, EventMapping, Release
)
from sentry.testutils import TestCase, TransactionTestCase


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

    def test_similar_message_prefix_doesnt_group(self):
        # we had a regression which caused the default hash to just be
        # 'event.message' instead of '[event.message]' which caused it to
        # generate a hash per letter
        manager = EventManager(self.make_event(message='foo bar'))
        event1 = manager.save(1)

        manager = EventManager(self.make_event(message='foo baz'))
        event2 = manager.save(1)

        assert event1.group_id != event2.group_id

    @patch('sentry.signals.regression_signal.send')
    def test_broken_regression_signal(self, send):
        send.side_effect = Exception()

        manager = EventManager(self.make_event())
        event = manager.save(1)

        assert event.message == 'foo'
        assert event.project_id == 1

    @patch('sentry.event_manager.should_sample')
    def test_saves_event_mapping_when_sampled(self, should_sample):
        should_sample.return_value = True
        event_id = 'a' * 32

        manager = EventManager(self.make_event())
        event = manager.save(1)

        assert EventMapping.objects.filter(
            group_id=event.group_id,
            event_id=event_id,
        ).exists()

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
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
                'env': {
                    'REMOTE_ADDR': '127.0.0.1',
                }
            }
        }))
        data = manager.normalize()
        assert data['sentry.interfaces.User']['ip_address'] == '127.0.0.1'

    def test_does_default_ip_address_if_present(self):
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
                'env': {
                    'REMOTE_ADDR': '127.0.0.1',
                }
            },
            'sentry.interfaces.User': {
                'ip_address': '192.168.0.1',
            },
        }))
        data = manager.normalize()
        assert data['sentry.interfaces.User']['ip_address'] == '192.168.0.1'

    def test_does_not_default_invalid_ip_address(self):
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
                'env': {
                    'REMOTE_ADDR': '127.0.0.1, 192.168.0.1',
                }
            }
        }))
        data = manager.normalize()
        assert 'sentry.interfaces.User' not in data

    def test_platform_is_saved(self):
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.AppleCrashReport': {
                'crash': {},
                'binary_images': []
            }
        }))
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
        manager = EventManager(self.make_event(
            message='foo', event_id='a' * 32,
            checksum='a' * 32,
        ))
        event = manager.save(1)

        manager = EventManager(self.make_event(
            message='foo bar', event_id='b' * 32,
            checksum='a' * 32,
        ))
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
        manager = EventManager(self.make_event(
            message='foo', event_id='a' * 32,
            fingerprint=['a' * 32],
        ))
        with self.tasks():
            event = manager.save(1)

        manager = EventManager(self.make_event(
            message='foo bar', event_id='b' * 32,
            fingerprint=['a' * 32],
        ))
        with self.tasks():
            event2 = manager.save(1)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen.replace(microsecond=0) == event.datetime.replace(microsecond=0)
        assert group.message == event2.message

    def test_differentiates_with_fingerprint(self):
        manager = EventManager(self.make_event(
            message='foo', event_id='a' * 32,
            fingerprint=['{{ default }}', 'a' * 32],
        ))
        with self.tasks():
            event = manager.save(1)

        manager = EventManager(self.make_event(
            message='foo bar', event_id='b' * 32,
            fingerprint=['a' * 32],
        ))
        with self.tasks():
            event2 = manager.save(1)

        assert event.group_id != event2.group_id

    def test_unresolves_group(self):
        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1. MySQL doesn't support microseconds.
        manager = EventManager(self.make_event(
            event_id='a' * 32, checksum='a' * 32,
            timestamp=1403007314,
        ))
        with self.tasks():
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(self.make_event(
            event_id='b' * 32, checksum='a' * 32,
            timestamp=1403007345,
        ))
        event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert not group.is_resolved()

    @patch('sentry.event_manager.plugin_is_regression')
    def test_does_not_unresolve_group(self, plugin_is_regression):
        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1. MySQL doesn't support microseconds.
        plugin_is_regression.return_value = False

        manager = EventManager(self.make_event(
            event_id='a' * 32, checksum='a' * 32,
            timestamp=1403007314,
        ))
        with self.tasks():
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(self.make_event(
            event_id='b' * 32, checksum='a' * 32,
            timestamp=1403007315,
        ))
        event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert group.is_resolved()

    @patch('sentry.event_manager.plugin_is_regression')
    def test_marks_as_unresolved_only_with_new_release(self, plugin_is_regression):
        plugin_is_regression.return_value = True

        old_release = Release.objects.create(
            version='a',
            project=self.project,
            date_added=timezone.now() - timedelta(minutes=30),
        )

        manager = EventManager(self.make_event(
            event_id='a' * 32,
            checksum='a' * 32,
            timestamp=time() - 50000,  # need to work around active_at
            release=old_release.version,
        ))
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

        manager = EventManager(self.make_event(
            event_id='b' * 32,
            checksum='a' * 32,
            timestamp=time(),
            release=old_release.version,
        ))
        event = manager.save(1)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data['version'] == ''

        assert GroupResolution.objects.filter(group=group).exists()

        manager = EventManager(self.make_event(
            event_id='c' * 32,
            checksum='a' * 32,
            timestamp=time(),
            release='b',
        ))
        event = manager.save(1)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data['version'] == 'b'

        assert not GroupResolution.objects.filter(group=group).exists()

        assert Activity.objects.filter(
            group=group,
            type=Activity.SET_REGRESSION,
        ).exists()

    @patch('sentry.models.Group.is_resolved')
    def test_unresolves_group_with_auto_resolve(self, mock_is_resolved):
        mock_is_resolved.return_value = False
        manager = EventManager(self.make_event(
            event_id='a' * 32, checksum='a' * 32,
            timestamp=1403007314,
        ))
        with self.tasks():
            event = manager.save(1)

        mock_is_resolved.return_value = True
        manager = EventManager(self.make_event(
            event_id='b' * 32, checksum='a' * 32,
            timestamp=1403007414,
        ))
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

    def test_long_message(self):
        manager = EventManager(self.make_event(
            message='x' * (settings.SENTRY_MAX_MESSAGE_LENGTH + 1),
        ))
        data = manager.normalize()
        assert len(data['message']) == settings.SENTRY_MAX_MESSAGE_LENGTH

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

    def test_bad_logger(self):
        manager = EventManager(self.make_event(logger='foo bar'))
        data = manager.normalize()
        assert data['logger'] == DEFAULT_LOGGER_NAME

    def test_record_frequencies(self):
        project = self.project
        manager = EventManager(self.make_event())
        event = manager.save(project)

        assert tsdb.get_most_frequent(
            tsdb.models.frequent_issues_by_project,
            (event.project.id,),
            event.datetime,
        ) == {
            event.project.id: [
                (event.group_id, 1.0),
            ],
        }

        assert tsdb.get_most_frequent(
            tsdb.models.frequent_projects_by_organization,
            (event.project.organization_id,),
            event.datetime,
        ) == {
            event.project.organization_id: [
                (event.project_id, 1.0),
            ],
        }

    def test_event_user(self):
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.User': {
                'id': '1',
            }
        }))
        manager.normalize()
        event = manager.save(self.project.id)

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_group,
            (event.group.id,),
            event.datetime,
            event.datetime,
        ) == {
            event.group.id: 1,
        }

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_project,
            (event.project.id,),
            event.datetime,
            event.datetime,
        ) == {
            event.project.id: 1,
        }

        assert EventUser.objects.filter(
            project=self.project,
            ident='1',
        ).exists()
        assert 'sentry:user' in dict(event.tags)

        # ensure event user is mapped to tags in second attempt
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.User': {
                'id': '1',
            }
        }))
        manager.normalize()
        event = manager.save(self.project.id)

        assert EventUser.objects.filter(
            project=self.project,
            ident='1',
        ).exists()
        assert 'sentry:user' in dict(event.tags)

    def test_event_user_unicode_identifier(self):
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.User': {
                'username': u'foô'
            }
        }))
        manager.normalize()
        manager.save(self.project.id)
        euser = EventUser.objects.get(
            project=self.project,
        )
        assert euser.username == u'foô'

    def test_environment(self):
        manager = EventManager(self.make_event(**{
            'environment': 'beta',
        }))
        manager.normalize()
        event = manager.save(self.project.id)

        assert dict(event.tags).get('environment') == 'beta'

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

    def test_error_event_type(self):
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'Foo',
                    'value': 'bar',
                }],
            },
        }))
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
        manager = EventManager(self.make_event(**{
            'sentry.interfaces.Csp': {
                'effective_directive': 'script-src',
                'blocked_uri': 'http://example.com',
            },
        }))
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


class GetHashesFromEventTest(TestCase):
    @patch('sentry.interfaces.stacktrace.Stacktrace.compute_hashes')
    @patch('sentry.interfaces.http.Http.compute_hashes')
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
                    'frames': [{
                        'lineno': 1,
                        'filename': 'foo.py',
                    }, {
                        'lineno': 1,
                        'filename': 'foo.py',
                        'in_app': True,
                    }],
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
                    'frames': [{
                        'lineno': 1,
                        'filename': 'foo.py',
                    }, {
                        'lineno': 1,
                        'filename': 'foo.py',
                        'in_app': True,
                    }],
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
                'values': [{
                    'stacktrace': {
                        'frames': [{
                            'lineno': 1,
                            'filename': 'foo.py',
                        }, {
                            'lineno': 1,
                            'filename': 'bar.py',
                            'in_app': True,
                        }],
                    }
                }]
            },
            'sentry.interfaces.Stacktrace': {
                'frames': [{
                    'lineno': 1,
                    'filename': 'NOTME.py',
                }, {
                    'lineno': 1,
                    'filename': 'PLZNOTME.py',
                    'in_app': True,
                }],
            },
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        }
        assert generate_culprit(data) == 'bar.py in ?'

    def test_with_missing_exception_interface(self):
        data = {
            'sentry.interfaces.Stacktrace': {
                'frames': [{
                    'lineno': 1,
                    'filename': 'NOTME.py',
                }, {
                    'lineno': 1,
                    'filename': 'PLZNOTME.py',
                    'in_app': True,
                }],
            },
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        }
        assert generate_culprit(data) == 'PLZNOTME.py in ?'

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
                'values': [{
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
