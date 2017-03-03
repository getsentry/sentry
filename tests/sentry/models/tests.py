# coding: utf-8

from __future__ import absolute_import

import pytest

from datetime import timedelta
from django.core import mail
from django.core.urlresolvers import reverse
from django.db import connection
from django.utils import timezone
from exam import fixture

from sentry.db.models.fields.node import NodeData, NodeIntegrityFailure
from sentry.models import ProjectKey, Event, LostPasswordHash
from sentry.testutils import TestCase
from sentry.utils.compat import pickle
from sentry.utils.strings import compress


class ProjectKeyTest(TestCase):
    def test_get_dsn(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.options({'system.url-prefix': 'http://example.com'}):
            self.assertEquals(key.get_dsn(), 'http://public:secret@example.com/1')

    def test_get_dsn_with_ssl(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.options({'system.url-prefix': 'https://example.com'}):
            self.assertEquals(key.get_dsn(), 'https://public:secret@example.com/1')

    def test_get_dsn_with_port(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.options({'system.url-prefix': 'http://example.com:81'}):
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
        self.create_user('admin@example.com')
        team = self.create_team(name='Test')
        project = self.create_project(name='Test', team=team)
        assert project.key_set.exists() is True


class LostPasswordTest(TestCase):
    @fixture
    def password_hash(self):
        return LostPasswordHash.objects.create(
            user=self.user,
        )

    def test_send_recover_mail(self):
        with self.options({'system.url-prefix': 'http://testserver'}), self.tasks():
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
            "INSERT INTO sentry_message (group_id, project_id, data, message, datetime)",
            "VALUES(%s, %s, %s, %s, %s)",
        ]
        params = [group.id, group.project_id, compress(pickle.dumps(data)), 'test', timezone.now()]

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

    def test_screams_bloody_murder_when_ref_fails(self):
        project1 = self.create_project()
        project2 = self.create_project()
        group1 = self.create_group(project1)
        invalid_event = self.create_event(group=group1)
        group2 = self.create_group(project2)
        event = self.create_event(group=group2)
        event.data.bind_ref(invalid_event)
        event.save()

        assert event.data.get_ref(event) != event.data.get_ref(invalid_event)

        with pytest.raises(NodeIntegrityFailure):
            Event.objects.bind_nodes([event], 'data')

    def test_accepts_valid_ref(self):
        event = self.create_event()
        event.data.bind_ref(event)
        event.save()

        Event.objects.bind_nodes([event], 'data')

        assert event.data.ref == event.project.id

    def test_basic_ref_binding(self):
        event = self.create_event()
        assert event.data.get_ref(event) == event.project.id
