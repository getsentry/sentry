# coding: utf-8

from __future__ import absolute_import

from datetime import timedelta
from django.core import mail
from django.core.urlresolvers import reverse
from django.db import connection
from django.utils import timezone
from exam import fixture

from sentry.db.models.fields.node import NodeData
from sentry.models import (
    Project, ProjectKey, Group, Event,
    GroupTagValue, TagValue, LostPasswordHash
)
from sentry.testutils import TestCase
from sentry.utils.compat import pickle
from sentry.utils.strings import compress


class ProjectTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.project = Project.objects.get(id=1)

    def test_migrate(self):
        project2 = self.create_project(name='Test')
        self.project.merge_to(project2)

        self.assertFalse(Project.objects.filter(pk=1).exists())
        self.assertFalse(Group.objects.filter(project__isnull=True).exists())
        self.assertFalse(Event.objects.filter(project__isnull=True).exists())
        self.assertFalse(GroupTagValue.objects.filter(project__isnull=True).exists())
        self.assertFalse(TagValue.objects.filter(project__isnull=True).exists())

        self.assertEquals(project2.group_set.count(), 4)
        self.assertEquals(project2.event_set.count(), 10)
        assert not GroupTagValue.objects.filter(project=project2).exists()
        assert not TagValue.objects.filter(project=project2).exists()


class ProjectKeyTest(TestCase):
    def test_get_dsn(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.settings(SENTRY_URL_PREFIX='http://example.com'):
            self.assertEquals(key.get_dsn(), 'http://public:secret@example.com/1')

    def test_get_dsn_with_ssl(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.settings(SENTRY_URL_PREFIX='https://example.com'):
            self.assertEquals(key.get_dsn(), 'https://public:secret@example.com/1')

    def test_get_dsn_with_port(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.settings(SENTRY_URL_PREFIX='http://example.com:81'):
            self.assertEquals(key.get_dsn(), 'http://public:secret@example.com:81/1')

    def test_get_dsn_with_public_endpoint_setting(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.settings(SENTRY_PUBLIC_ENDPOINT='http://public_endpoint.com'):
            self.assertEquals(key.get_dsn(public=True), 'http://public@public_endpoint.com/1')

    def test_get_dsn_with_endpoint_setting(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.settings(SENTRY_ENDPOINT='http://endpoint.com'):
            self.assertEquals(key.get_dsn(), 'http://public:secret@endpoint.com/1')

    def test_key_is_created_for_project(self):
        user = self.create_user('admin@example.com')
        team = self.create_team(name='Test', owner=user)
        project = self.create_project(name='Test', team=team)
        assert project.key_set.filter(user__isnull=True).exists() is True


class LostPasswordTest(TestCase):
    @fixture
    def password_hash(self):
        return LostPasswordHash.objects.create(
            user=self.user,
        )

    def test_send_recover_mail(self):
        with self.settings(SENTRY_URL_PREFIX='http://testserver', CELERY_ALWAYS_EAGER=True):
            self.password_hash.send_recover_mail()

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == [self.user.email]
        assert msg.subject == '[Sentry] Password Recovery'
        url = 'http://testserver' + reverse('sentry-account-recover-confirm',
            args=[self.password_hash.user_id, self.password_hash.hash])
        assert url in msg.body


class GroupIsOverResolveAgeTest(TestCase):
    def test_simple(self):
        group = self.group
        group.last_seen = timezone.now() - timedelta(hours=2)
        group.project.update_option('sentry:resolve_age', 1)  # 1 hour
        assert group.is_over_resolve_age() is True
        group.last_seen = timezone.now()
        assert group.is_over_resolve_age() is False


class EventNodeStoreTest(TestCase):
    def test_does_transition_data_to_node(self):
        group = self.group
        data = {'key': 'value'}

        query_bits = [
            "INSERT INTO sentry_message (group_id, project_id, data, message, checksum, datetime)",
            "VALUES(%s, %s, %s, %s, %s, %s)",
        ]
        params = [group.id, group.project_id, compress(pickle.dumps(data)), 'test', 'a' * 32, timezone.now()]

        # This is pulled from SQLInsertCompiler
        if connection.features.can_return_id_from_insert:
            r_fmt, r_params = connection.ops.return_insert_id()
            if r_fmt:
                query_bits.append(r_fmt % Event._meta.pk.column)
                params += r_params

        cursor = connection.cursor()
        cursor.execute(' '.join(query_bits), params)

        if connection.features.can_return_id_from_insert:
            event_id = connection.ops.fetch_returned_insert_id(cursor)
        else:
            event_id = connection.ops.last_insert_id(
                cursor, Event._meta.db_table, Event._meta.pk.column)

        event = Event.objects.get(id=event_id)
        assert type(event.data) == NodeData
        assert event.data == data
        assert event.data.id is None

        event.save()

        assert event.data == data
        assert event.data.id is not None

        node_id = event.data.id
        event = Event.objects.get(id=event_id)

        Event.objects.bind_nodes([event], 'data')

        assert event.data == data
        assert event.data.id == node_id
