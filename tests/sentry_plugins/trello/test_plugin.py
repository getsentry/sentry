from __future__ import absolute_import

import responses

from django.core.urlresolvers import reverse
from exam import fixture
from sentry.models import GroupMeta, AuditLogEntry, AuditLogEntryEvent, ProjectOption
from sentry.plugins.base import register, unregister
from sentry.testutils import TestCase
from sentry.utils import json
from sentry.testutils.helpers.datetime import iso_format, before_now

from sentry_plugins.trello.plugin import TrelloPlugin

base_template_path = "sentry/plugins/"


def show_response_error(response):
    if response.context and "form" in response.context:
        return dict(response.context["form"].errors)
    return (response.status_code, response.content[:128].strip())


def trello_mock():
    # TODO(dcramer): we cannot currently assert on auth, which is pretty damned
    # important

    mock = responses.RequestsMock(assert_all_requests_are_fired=False)
    mock.add(mock.GET, "https://trello.com/1/members/me/boards", json=[{"id": "1", "name": "Foo"}])
    mock.add(
        mock.POST,
        "https://trello.com/1/cards",
        json={"id": "2", "url": "https://example.trello.com/cards/2"},
    )
    mock.add(
        mock.GET, "https://trello.com/1/members/me/organizations", json=[{"id": "3", "name": "Bar"}]
    )

    return mock


class TrelloPluginTest(TestCase):
    plugin_cls = TrelloPlugin

    def setUp(self):
        super(TrelloPluginTest, self).setUp()
        register(self.plugin_cls)

        min_ago = iso_format(before_now(minutes=1))
        self.project = self.create_project()
        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Hello world",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.group = self.event.group

    def tearDown(self):
        unregister(self.plugin_cls)
        super(TrelloPluginTest, self).tearDown()

    @fixture
    def plugin(self):
        return self.plugin_cls()

    @fixture
    def action_path(self):
        project = self.project
        return reverse(
            "sentry-group-plugin-action",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "group_id": self.group.id,
                "slug": self.plugin.slug,
            },
        )

    @fixture
    def configure_path(self):
        project = self.project
        return reverse(
            "sentry-api-0-project-plugin-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "plugin_id": self.plugin.slug,
            },
        )

    def test_create_issue_renders(self):
        project = self.project
        plugin = self.plugin

        plugin.set_option("key", "foo", project)
        plugin.set_option("token", "bar", project)

        self.login_as(self.user)

        with trello_mock(), self.options({"system.url-prefix": "http://example.com"}):
            response = self.client.get(self.action_path)

        assert response.status_code == 200, vars(response)
        self.assertTemplateUsed(
            response, "%strello/create_trello_issue.html" % (base_template_path)
        )

    def test_create_issue_saves(self):
        project = self.project
        plugin = self.plugin

        plugin.set_option("key", "foo", project)
        plugin.set_option("token", "bar", project)

        self.login_as(self.user)

        with trello_mock() as mock:
            response = self.client.post(
                self.action_path,
                {
                    "title": "foo",
                    "description": "A ticket description",
                    "trello_board": "1",
                    "trello_list": "15",
                },
            )

            assert response.status_code == 302, show_response_error(response)
            meta = GroupMeta.objects.get(group=self.group, key="trello:tid")
            assert meta.value == "2/https://example.trello.com/cards/2"

            trello_request = mock.calls[-1].request
            assert trello_request.url == "https://trello.com/1/cards?token=bar&key=foo"
            assert json.loads(trello_request.body) == {
                "desc": "A ticket description",
                "idList": "15",
                "name": "foo",
            }

    def test_can_get_config(self):
        self.login_as(user=self.user)
        response = self.client.get(self.configure_path)
        assert response.status_code == 200
        assert response.data["id"] == "trello"
        assert response.data["config"] == [
            {
                "readonly": False,
                "choices": None,
                "placeholder": None,
                "name": u"key",
                "help": None,
                "defaultValue": None,
                "required": True,
                "type": "text",
                "value": None,
                "label": u"Trello API Key",
            },
            {
                "help": None,
                "prefix": "",
                "label": u"Trello API Token",
                "placeholder": None,
                "name": u"token",
                "defaultValue": None,
                "required": True,
                "hasSavedValue": False,
                "value": None,
                "choices": None,
                "readonly": False,
                "type": "secret",
            },
        ]

    def test_can_get_config_with_options(self):
        project = self.project
        plugin = self.plugin

        plugin.set_option("key", "foo", project)
        plugin.set_option("token", "bar", project)

        self.login_as(self.user)

        with trello_mock():
            response = self.client.get(self.configure_path)
        assert response.status_code == 200
        assert response.data["id"] == "trello"
        assert response.data["config"] == [
            {
                "readonly": False,
                "choices": None,
                "placeholder": None,
                "name": u"key",
                "help": None,
                "defaultValue": u"foo",
                "required": True,
                "type": "text",
                "value": u"foo",
                "label": u"Trello API Key",
            },
            {
                "help": None,
                "prefix": u"bar",
                "label": u"Trello API Token",
                "placeholder": None,
                "name": u"token",
                "defaultValue": None,
                "required": False,
                "hasSavedValue": True,
                "value": None,
                "choices": None,
                "readonly": False,
                "type": "secret",
            },
            {
                "readonly": False,
                "choices": (("", "--"), ("3", "Bar")),
                "placeholder": None,
                "name": u"organization",
                "help": None,
                "defaultValue": None,
                "required": True,
                "type": "select",
                "value": None,
                "label": u"Trello Organization",
            },
        ]

    def test_can_enable_plugin(self):
        self.login_as(user=self.user)
        self.plugin.disable(self.project)

        audit = AuditLogEntry.objects.filter(target_object=self.project.id)
        assert not audit

        response = self.client.post(self.configure_path)
        audit = AuditLogEntry.objects.get(target_object=self.project.id)
        assert audit.event == AuditLogEntryEvent.INTEGRATION_ADD
        assert response.status_code == 201, (response.status_code, response.content)

        assert ProjectOption.objects.get(key="trello:enabled", project=self.project).value is True
        audit.delete()

    def test_can_disable_plugin(self):
        self.login_as(user=self.user)
        self.plugin.enable(self.project)

        audit = AuditLogEntry.objects.filter(target_object=self.project.id)
        assert not audit

        response = self.client.delete(self.configure_path)
        audit = AuditLogEntry.objects.get(target_object=self.project.id)
        assert audit.event == AuditLogEntryEvent.INTEGRATION_REMOVE
        assert response.status_code == 204, (response.status_code, response.content)

        assert ProjectOption.objects.get(key="trello:enabled", project=self.project).value is False
        audit.delete()

    @responses.activate
    def test_create_issue_with_fetch_errors(self):
        project = self.project
        plugin = self.plugin

        plugin.set_option("key", "foo", project)
        plugin.set_option("token", "bar", project)

        self.login_as(self.user)

        response = self.client.get(self.action_path)

        assert response.status_code == 200, vars(response)
        self.assertTemplateUsed(
            response, "%strello/plugin_misconfigured.html" % (base_template_path)
        )

    def test_configure_saves_options(self):
        self.login_as(self.user)
        with trello_mock():
            response = self.client.put(
                self.configure_path,
                content_type="application/json",
                data=json.dumps(
                    {"plugin": "trello", "token": "foo", "key": "bar", "organization": None}
                ),
            )
        assert response.status_code == 200, show_response_error(response)

        project = self.project
        plugin = self.plugin
        assert plugin.get_option("token", project) == "foo"
        assert plugin.get_option("key", project) == "bar"
