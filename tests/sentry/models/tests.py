# coding: utf-8

from __future__ import absolute_import

import pytest

from datetime import timedelta
from django.core import mail
from django.core.urlresolvers import reverse

from django.http import HttpRequest
from django.utils import timezone
from exam import fixture

from sentry import eventstore, nodestore
from sentry.db.models.fields.node import NodeIntegrityFailure
from sentry.models import ProjectKey, LostPasswordHash
from sentry.testutils import TestCase
from sentry.eventstore.models import Event
from sentry.testutils.helpers.datetime import iso_format, before_now


class ProjectKeyTest(TestCase):
    def test_get_dsn(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.options({"system.url-prefix": "http://example.com"}):
            self.assertEquals(key.get_dsn(), "http://public:secret@example.com/1")

    def test_get_dsn_with_ssl(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.options({"system.url-prefix": "https://example.com"}):
            self.assertEquals(key.get_dsn(), "https://public:secret@example.com/1")

    def test_get_dsn_with_port(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.options({"system.url-prefix": "http://example.com:81"}):
            self.assertEquals(key.get_dsn(), "http://public:secret@example.com:81/1")

    def test_get_dsn_with_public_endpoint_setting(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.settings(SENTRY_PUBLIC_ENDPOINT="http://public_endpoint.com"):
            self.assertEquals(key.get_dsn(public=True), "http://public@public_endpoint.com/1")

    def test_get_dsn_with_endpoint_setting(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.settings(SENTRY_ENDPOINT="http://endpoint.com"):
            self.assertEquals(key.get_dsn(), "http://public:secret@endpoint.com/1")

    def test_key_is_created_for_project(self):
        self.create_user("admin@example.com")
        team = self.create_team(name="Test")
        project = self.create_project(name="Test", teams=[team])
        assert project.key_set.exists() is True


class LostPasswordTest(TestCase):
    @fixture
    def password_hash(self):
        return LostPasswordHash.objects.create(user=self.user)

    def test_send_recover_mail(self):
        request = HttpRequest()
        request.method = "GET"
        request.META["REMOTE_ADDR"] = "1.1.1.1"

        with self.options({"system.url-prefix": "http://testserver"}), self.tasks():
            self.password_hash.send_email(request)

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == [self.user.email]
        assert msg.subject == "[Sentry] Password Recovery"
        url = "http://testserver" + reverse(
            "sentry-account-recover-confirm",
            args=[self.password_hash.user_id, self.password_hash.hash],
        )
        assert url in msg.body


class GroupIsOverResolveAgeTest(TestCase):
    def test_simple(self):
        group = self.group
        group.last_seen = timezone.now() - timedelta(hours=2)
        group.project.update_option("sentry:resolve_age", 1)  # 1 hour
        assert group.is_over_resolve_age() is True
        group.last_seen = timezone.now()
        assert group.is_over_resolve_age() is False


class EventNodeStoreTest(TestCase):
    def test_event_node_id(self):
        # Create an event without specifying node_id. A node_id should be generated
        e1 = Event(project_id=1, event_id="abc", data={"foo": "bar"})
        assert e1.data.id is not None, "We should have generated a node_id for this event"
        e1_node_id = e1.data.id
        e1.data.save()
        e1_body = nodestore.get(e1_node_id)
        assert e1_body == {"foo": "bar"}, "The event body should be in nodestore"

        e1 = Event(project_id=1, event_id="abc")

        assert e1.data.data == {"foo": "bar"}, "The event body should be loaded from nodestore"
        assert e1.data.id == e1_node_id, "The event's node_id should be the same after load"

        # Event with no data should not be saved to nodestore
        e2 = Event(project_id=1, event_id="mno", data=None)
        e2_node_id = e2.data.id
        assert e2.data.data == {}  # NodeData returns {} by default
        eventstore.bind_nodes([e2], "data")
        assert e2.data.data == {}
        e2_body = nodestore.get(e2_node_id)
        assert e2_body is None

    def test_screams_bloody_murder_when_ref_fails(self):
        project1 = self.create_project()
        project2 = self.create_project()
        invalid_event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
            },
            project_id=project1.id,
        )
        event = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-2"],
            },
            project_id=project2.id,
        )
        event.data.bind_ref(invalid_event)
        event.data.save()

        assert event.data.get_ref(event) != event.data.get_ref(invalid_event)

        # Unload node data to force reloading from nodestore
        event.data._node_data = None

        with pytest.raises(NodeIntegrityFailure):
            eventstore.bind_nodes([event])

    def test_accepts_valid_ref(self):
        self.store_event(data={"event_id": "a" * 32}, project_id=self.project.id)
        event = Event(project_id=self.project.id, event_id="a" * 32)
        event.data.bind_ref(event)
        assert event.data.ref == event.project.id

    def test_basic_ref_binding(self):
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.data.get_ref(event) == event.project.id
