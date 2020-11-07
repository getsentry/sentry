from __future__ import absolute_import

import six
from sentry.utils.compat import mock
import copy

from sentry.integrations.example.integration import ExampleIntegration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.models import Activity, ExternalIssue, GroupLink, Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import iso_format, before_now


class GroupIntegrationDetailsTest(APITestCase):
    def setUp(self):
        super(GroupIntegrationDetailsTest, self).setUp()
        self.min_ago = before_now(minutes=1)
        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(self.min_ago),
                "message": "message",
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=self.project.id,
        )
        self.group = self.event.group

    def test_simple_get_link(self):
        self.login_as(user=self.user)
        org = self.organization
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        path = u"/api/0/issues/{}/integrations/{}/?action=link".format(
            self.group.id, integration.id
        )

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.get(path)
            provider = integration.get_provider()

            assert response.data == {
                "id": six.text_type(integration.id),
                "name": integration.name,
                "icon": integration.metadata.get("icon"),
                "domainName": integration.metadata.get("domain_name"),
                "accountType": integration.metadata.get("account_type"),
                "status": integration.get_status_display(),
                "provider": {
                    "key": provider.key,
                    "slug": provider.key,
                    "name": provider.name,
                    "canAdd": provider.can_add,
                    "canDisable": provider.can_disable,
                    "features": [f.value for f in provider.features],
                    "aspects": provider.metadata.aspects,
                },
                "linkIssueConfig": [
                    {"default": "", "type": "string", "name": "externalIssue", "label": "Issue"},
                    {
                        "choices": [("1", "Project 1"), ("2", "Project 2")],
                        "label": "Project",
                        "name": "project",
                        "type": "select",
                    },
                ],
            }

    def test_simple_get_create(self):
        self.login_as(user=self.user)
        org = self.organization
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)
        group = self.group

        path = u"/api/0/issues/{}/integrations/{}/?action=create".format(group.id, integration.id)

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.get(path)
            provider = integration.get_provider()

            assert response.data == {
                "id": six.text_type(integration.id),
                "name": integration.name,
                "icon": integration.metadata.get("icon"),
                "domainName": integration.metadata.get("domain_name"),
                "accountType": integration.metadata.get("account_type"),
                "status": integration.get_status_display(),
                "provider": {
                    "key": provider.key,
                    "slug": provider.key,
                    "name": provider.name,
                    "canAdd": provider.can_add,
                    "canDisable": provider.can_disable,
                    "features": [f.value for f in provider.features],
                    "aspects": provider.metadata.aspects,
                },
                "createIssueConfig": [
                    {
                        "default": "message",
                        "type": "string",
                        "name": "title",
                        "label": "Title",
                        "required": True,
                    },
                    {
                        "default": (
                            "Sentry Issue: [%s](%s)\n\n```\n"
                            "Stacktrace (most recent call first):\n\n  "
                            'File "sentry/models/foo.py", line 29, in build_msg\n    '
                            "string_max_length=self.string_max_length)\n\nmessage\n```"
                        )
                        % (
                            group.qualified_short_id,
                            absolute_uri(
                                group.get_absolute_url(params={"referrer": "example_integration"})
                            ),
                        ),
                        "type": "textarea",
                        "name": "description",
                        "label": "Description",
                        "autosize": True,
                        "maxRows": 10,
                    },
                    {
                        "choices": [("1", "Project 1"), ("2", "Project 2")],
                        "type": "select",
                        "name": "project",
                        "label": "Project",
                    },
                ],
            }

    def test_get_create_with_error(self):
        self.login_as(user=self.user)
        org = self.organization
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        path = u"/api/0/issues/{}/integrations/{}/?action=create".format(
            self.group.id, integration.id
        )

        with self.feature("organizations:integrations-issue-basic"):
            with mock.patch.object(
                ExampleIntegration, "get_create_issue_config", side_effect=IntegrationError("oops")
            ):
                response = self.client.get(path)

                assert response.status_code == 400
                assert response.data == {"detail": "oops"}

    def test_get_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        path = u"/api/0/issues/{}/integrations/{}/?action=create".format(
            self.group.id, integration.id
        )

        with self.feature({"organizations:integrations-issue-basic": False}):
            response = self.client.get(path)
        assert response.status_code == 400
        assert response.data["detail"] == "Your organization does not have access to this feature."

    def test_simple_put(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        path = u"/api/0/issues/{}/integrations/{}/".format(group.id, integration.id)
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.put(path, data={"externalIssue": "APP-123"})

            assert response.status_code == 201
            external_issue = ExternalIssue.objects.get(
                key="APP-123", integration_id=integration.id, organization_id=org.id
            )
            assert external_issue.title == "This is a test external issue title"
            assert external_issue.description == "This is a test external issue description"
            assert GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue,
                group_id=group.id,
                linked_id=external_issue.id,
            ).exists()

            activity = Activity.objects.filter(type=Activity.CREATE_ISSUE)[0]
            assert activity.project_id == group.project_id
            assert activity.group_id == group.id
            assert activity.ident is None
            assert activity.user_id == self.user.id
            assert activity.data == {
                "title": "This is a test external issue title",
                "provider": "Example",
                "location": "https://example/issues/APP-123",
                "label": "display name: APP-123",
            }

    def test_put_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        path = u"/api/0/issues/{}/integrations/{}/".format(group.id, integration.id)

        with self.feature({"organizations:integrations-issue-basic": False}):
            response = self.client.put(path, data={"externalIssue": "APP-123"})
        assert response.status_code == 400
        assert response.data["detail"] == "Your organization does not have access to this feature."

    def test_simple_post(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        path = u"/api/0/issues/{}/integrations/{}/".format(group.id, integration.id)

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.post(path, data={})
            assert response.status_code == 400
            assert response.data["non_field_errors"] == ["Assignee is required"]

            response = self.client.post(path, data={"assignee": "foo@sentry.io"})
            assert response.status_code == 201

            external_issue = ExternalIssue.objects.get(
                key="APP-123", integration_id=integration.id, organization_id=org.id
            )
            assert external_issue.description == u"This is a test external issue description"
            assert external_issue.title == u"This is a test external issue title"

            assert GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue,
                group_id=group.id,
                linked_id=external_issue.id,
            ).exists()

            activity = Activity.objects.filter(type=Activity.CREATE_ISSUE)[0]
            assert activity.project_id == group.project_id
            assert activity.group_id == group.id
            assert activity.ident is None
            assert activity.user_id == self.user.id
            assert activity.data == {
                "title": "This is a test external issue title",
                "provider": "Example",
                "location": "https://example/issues/APP-123",
                "label": "display name: APP-123",
            }

    def test_post_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        path = u"/api/0/issues/{}/integrations/{}/".format(group.id, integration.id)

        with self.feature({"organizations:integrations-issue-basic": False}):
            response = self.client.post(path, data={})
        assert response.status_code == 400
        assert response.data["detail"] == "Your organization does not have access to this feature."

    def test_simple_delete(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=org.id, integration_id=integration.id, key="APP-123"
        )[0]

        group_link = GroupLink.objects.get_or_create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )[0]

        path = u"/api/0/issues/{}/integrations/{}/?externalIssue={}".format(
            group.id, integration.id, external_issue.id
        )

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.delete(path)

            assert response.status_code == 204
            assert not ExternalIssue.objects.filter(id=external_issue.id).exists()
            assert not GroupLink.objects.filter(id=group_link.id).exists()

    def test_delete_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)

        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=org.id, integration_id=integration.id, key="APP-123"
        )[0]

        GroupLink.objects.get_or_create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )[0]

        path = u"/api/0/issues/{}/integrations/{}/?externalIssue={}".format(
            group.id, integration.id, external_issue.id
        )

        with self.feature({"organizations:integrations-issue-basic": False}):
            response = self.client.delete(path)
        assert response.status_code == 400
        assert response.data["detail"] == "Your organization does not have access to this feature."

    def test_default_project(self):
        def assert_default_project(path, action, expected_project_field):
            response = self.client.get(path)
            assert response.status_code == 200
            if action == "create":
                fields = response.data["createIssueConfig"]
            else:
                fields = response.data["linkIssueConfig"]
            assert response.data["id"] == six.text_type(integration.id)
            for field in fields:
                if field["name"] == "project":
                    project_field = field
                    break

            assert project_field == expected_project_field

        self.login_as(user=self.user)
        org = self.organization
        event = self.store_event(
            data={"event_id": "b" * 32, "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )
        group = event.group
        integration = Integration.objects.create(provider="example", name="Example")
        org_integration = integration.add_organization(org, self.user)
        org_integration.config = {"project_issue_defaults": {group.project_id: {"project": "2"}}}
        org_integration.save()
        create_path = u"/api/0/issues/{}/integrations/{}/?action=create".format(
            group.id, integration.id
        )
        link_path = u"/api/0/issues/{}/integrations/{}/?action=link".format(
            group.id, integration.id
        )
        project_field = {
            "name": "project",
            "label": "Project",
            "choices": [("1", "Project 1"), ("2", "Project 2")],
            "type": "select",
            "default": "2",
        }
        with self.feature("organizations:integrations-issue-basic"):
            assert_default_project(create_path, "create", project_field)
            assert_default_project(link_path, "link", project_field)
