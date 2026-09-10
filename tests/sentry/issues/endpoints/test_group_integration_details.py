from typing import Any
from unittest import mock

import responses
from django.db.utils import IntegrityError

from sentry.integrations.example.integration import ExampleIntegration
from sentry.integrations.models import Integration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import (
    IntegrationConfigurationError,
    IntegrationError,
    IntegrationFormError,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.users.services.user_option import get_option_from_list, user_option_service
from sentry.utils.http import absolute_uri

pytestmark = [requires_snuba]


def raise_integration_form_error(*args: Any, **kwargs: Any) -> None:
    raise IntegrationFormError(field_errors={"foo": "Invalid foo provided"})


def raise_integration_error(*args: Any, **kwargs: Any) -> None:
    raise IntegrationError("The whole operation was invalid")


def raise_integration_installation_configuration_error(*args: Any, **kwargs: Any) -> None:
    raise IntegrationConfigurationError("Repository has no issue tracker.")


class GroupIntegrationDetailsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago.isoformat(),
                "message": "message",
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        self.group = self.event.group

    def assert_metric_recorded(
        self, mock_metric_method: Any, expected_exc: type[Exception], exc_args: Any | None = None
    ) -> None:
        assert mock_metric_method.call_count == 1
        mock_metric_method.assert_called_with(mock.ANY)
        call_arg = mock_metric_method.call_args_list[0][0][0]
        assert isinstance(call_arg, expected_exc)

        if exc_args:
            assert call_arg.args == (exc_args,)

    def test_simple_get_link(self) -> None:
        self.login_as(user=self.user)
        org = self.organization
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/integrations/{integration.id}/?action=link"

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.get(path)
            provider = integration.get_provider()
            assert provider.metadata is not None

            assert response.data == {
                "id": str(integration.id),
                "name": integration.name,
                "icon": integration.metadata.get("icon"),
                "domainName": integration.metadata.get("domain_name"),
                "accountType": integration.metadata.get("account_type"),
                "scopes": integration.metadata.get("scopes"),
                "outOfDate": None,
                "status": integration.get_status_display(),
                "provider": {
                    "key": provider.key,
                    "slug": provider.key,
                    "name": provider.name,
                    "canAdd": provider.can_add,
                    "canDisable": provider.can_disable,
                    "features": sorted(f.value for f in provider.features),
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

    def test_simple_get_create(self) -> None:
        self.login_as(user=self.user)
        org = self.organization
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )
        group = self.group

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/?action=create"

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.get(path)
            provider = integration.get_provider()
            assert provider.metadata is not None

            assert response.data == {
                "id": str(integration.id),
                "name": integration.name,
                "icon": integration.metadata.get("icon"),
                "domainName": integration.metadata.get("domain_name"),
                "accountType": integration.metadata.get("account_type"),
                "scopes": integration.metadata.get("scopes"),
                "outOfDate": None,
                "status": integration.get_status_display(),
                "provider": {
                    "key": provider.key,
                    "slug": provider.key,
                    "name": provider.name,
                    "canAdd": provider.can_add,
                    "canDisable": provider.can_disable,
                    "features": sorted(f.value for f in provider.features),
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

    def test_get_create_with_error(self) -> None:
        self.login_as(user=self.user)
        org = self.organization
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/integrations/{integration.id}/?action=create"

        with self.feature("organizations:integrations-issue-basic"):
            with mock.patch.object(
                ExampleIntegration, "get_create_issue_config", side_effect=IntegrationError("oops")
            ):
                response = self.client.get(path)

                assert response.status_code == 400
                assert response.data == {"detail": "oops"}

    def test_get_feature_disabled(self) -> None:
        self.login_as(user=self.user)
        org = self.organization
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/integrations/{integration.id}/?action=create"

        with self.feature(
            {
                "organizations:integrations-issue-basic": False,
                "organizations:integrations-issue-sync": False,
            }
        ):
            response = self.client.get(path)
        assert response.status_code == 400
        assert response.data["detail"] == "Your organization does not have access to this feature."

    def assert_correctly_linked(
        self, group: Group, external_issue_id: str, integration: Integration, org: Organization
    ) -> None:
        external_issue = ExternalIssue.objects.get(
            key=external_issue_id, integration_id=integration.id, organization_id=org.id
        )
        assert external_issue.title == "This is a test external issue title"
        assert external_issue.description == "This is a test external issue description"
        assert GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.issue,
            group_id=group.id,
            linked_id=external_issue.id,
        ).exists()

        activity = Activity.objects.filter(type=ActivityType.CREATE_ISSUE.value).order_by("id")[0]
        assert activity.project_id == group.project_id
        assert activity.group_id == group.id
        assert activity.ident is None
        assert activity.user_id == self.user.id
        assert activity.data == {
            "title": "This is a test external issue title",
            "provider": "Example",
            "location": f"https://example/issues/{external_issue_id}",
            "label": f"display name: {external_issue_id}",
            "new": False,
        }

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_simple_put(self, mock_record_event: mock.MagicMock) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.put(path, data={"externalIssue": "APP-123"})

            assert response.status_code == 201
            self.assert_correctly_linked(group, "APP-123", integration, org)

        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @responses.activate
    def test_put_issue_url(self) -> None:
        self.login_as(self.user)
        integration = self.create_integration(
            organization=self.organization,
            provider="bitbucket",
            external_id="connect:123",
            name="myaccount",
            metadata={
                "domain_name": "bitbucket.org/myaccount",
                "base_url": "https://api.bitbucket.org",
                "shared_secret": "shared-secret",
                "subject": "connect:123",
            },
        )
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount/myrepo/issues/3",
            json={"id": 3, "title": "Existing issue", "content": {"html": "Description"}},
        )
        path = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/integrations/{integration.id}/"
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.put(
                path, data={"externalIssue": "https://bitbucket.org/myaccount/myrepo/issues/3"}
            )
        assert response.status_code == 201
        assert response.data["key"] == "myaccount/myrepo#3"
        assert GroupLink.objects.filter(
            group_id=self.group.id,
            linked_id=response.data["id"],
            linked_type=GroupLink.LinkedType.issue,
            relationship=GroupLink.Relationship.references,
        ).exists()
        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id, organization_id=self.organization.id
        )
        assert org_integration is not None
        assert org_integration.config["project_issue_defaults"][str(self.project.id)] == {
            "repo": "myaccount/myrepo"
        }
        assert len(responses.calls) == 1

    @responses.activate
    def test_put_issue_url_rejects_mismatched_target(self) -> None:
        self.login_as(self.user)
        integration = self.create_integration(
            organization=self.organization,
            provider="bitbucket",
            external_id="connect:123",
            name="myaccount",
            metadata={"domain_name": "bitbucket.org/myaccount"},
        )
        path = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/integrations/{integration.id}/"
        with self.feature("organizations:integrations-issue-basic"):
            for data in (
                {"externalIssue": "https://bitbucket.org/other/myrepo/issues/3"},
                {
                    "externalIssue": "https://bitbucket.org/myaccount/myrepo/issues/3",
                    "repo": "myaccount/other-repo",
                },
            ):
                response = self.client.put(path, data=data)
                assert response.status_code == 400
        assert not responses.calls
        assert not GroupLink.objects.filter(group_id=self.group.id).exists()

    @mock.patch.object(ExampleIntegration, "get_issue")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    def test_put_get_issue_raises_exception(
        self, mock_record_failure: Any, mock_record_halt: Any, mock_get_issue: Any
    ) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"
        with self.feature("organizations:integrations-issue-basic"):
            # Test with IntegrationFormError
            mock_get_issue.side_effect = raise_integration_form_error
            response = self.client.put(path, data={"externalIssue": "APP-123"})
            assert response.status_code == 400

            mock_record_halt.assert_called_once_with(mock.ANY)

            call_arg = mock_record_halt.call_args_list[0][0][0]
            assert isinstance(call_arg, IntegrationFormError)
            assert call_arg.field_errors == {"foo": "Invalid foo provided"}

            # Test with IntegrationError
            mock_get_issue.side_effect = raise_integration_error
            response = self.client.put(path, data={"externalIssue": "APP-123"})
            assert response.status_code == 400

            mock_record_failure.assert_called_once_with(mock.ANY)
            call_arg = mock_record_failure.call_args_list[0][0][0]
            assert isinstance(call_arg, IntegrationError)
            assert call_arg.args == ("The whole operation was invalid",)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    def test_put_group_link_already_exists(self, mock_record_halt: mock.MagicMock) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.put(path, data={"externalIssue": "APP-123"})

            assert response.status_code == 201
            self.assert_correctly_linked(group, "APP-123", integration, org)

            response = self.client.put(path, data={"externalIssue": "APP-123"})
            assert response.status_code == 400
            assert response.data == {"non_field_errors": ["That issue is already linked"]}

        mock_record_halt.assert_called_with(mock.ANY)
        call_arg = mock_record_halt.call_args_list[0][0][0]
        assert isinstance(call_arg, IntegrityError)

    @mock.patch.object(ExampleIntegration, "after_link_issue")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    def test_put_group_after_link_raises_exception(
        self, mock_record_failure: Any, mock_record_halt: Any, mock_after_link_issue: Any
    ) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"
        with self.feature("organizations:integrations-issue-basic"):
            # Test with IntegrationFormError
            mock_after_link_issue.side_effect = raise_integration_form_error
            response = self.client.put(path, data={"externalIssue": "APP-123"})
            assert response.status_code == 400

            self.assert_metric_recorded(
                mock_record_halt, IntegrationFormError, str({"foo": "Invalid foo provided"})
            )

            # Test with IntegrationError
            mock_after_link_issue.side_effect = raise_integration_error
            response = self.client.put(path, data={"externalIssue": "APP-123"})
            assert response.status_code == 400

            self.assert_metric_recorded(
                mock_record_failure, IntegrationError, "The whole operation was invalid"
            )

    def test_put_feature_disabled(self) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"

        with self.feature(
            {
                "organizations:integrations-issue-basic": False,
                "organizations:integrations-issue-sync": False,
            }
        ):
            response = self.client.put(path, data={"externalIssue": "APP-123"})
        assert response.status_code == 400
        assert response.data["detail"] == "Your organization does not have access to this feature."

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_simple_post(self, mock_record_event: mock.MagicMock) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.post(path, data={})
            assert response.status_code == 400
            assert response.data["non_field_errors"] == ["Assignee is required"]

            response = self.client.post(path, data={"assignee": "foo@sentry.io"})
            assert response.status_code == 201

            assert get_option_from_list(
                user_option_service.get_many(
                    filter={"user_ids": [self.user.id], "project_id": group.project_id}
                ),
                key="issue:defaults",
            ) == {"example": {}}

            external_issue = ExternalIssue.objects.get(
                key="APP-123", integration_id=integration.id, organization_id=org.id
            )
            assert external_issue.description == "This is a test external issue description"
            assert external_issue.title == "This is a test external issue title"

            assert GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue,
                group_id=group.id,
                linked_id=external_issue.id,
            ).exists()

            activity = Activity.objects.filter(type=ActivityType.CREATE_ISSUE.value).order_by("id")[
                0
            ]
            assert activity.project_id == group.project_id
            assert activity.group_id == group.id
            assert activity.ident is None
            assert activity.user_id == self.user.id
            assert activity.data == {
                "title": "This is a test external issue title",
                "provider": "Example",
                "location": "https://example/issues/APP-123",
                "label": "display name: APP-123",
                "new": True,
            }

            mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch.object(ExampleIntegration, "create_issue")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    def test_post_raises_issue_creation_exception(
        self, mock_record_failure: Any, mock_record_halt: Any, mock_create_issue: Any
    ) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"
        with self.feature("organizations:integrations-issue-basic"):
            mock_create_issue.side_effect = raise_integration_error
            response = self.client.post(path, data={})
            assert response.status_code == 400

            assert mock_record_failure.call_count == 1

            self.assert_metric_recorded(
                mock_record_failure, IntegrationError, "The whole operation was invalid"
            )

            mock_create_issue.side_effect = raise_integration_form_error

            response = self.client.post(path, data={})
            assert response.status_code == 400

            self.assert_metric_recorded(
                mock_record_halt, IntegrationFormError, str({"foo": "Invalid foo provided"})
            )

    @mock.patch.object(ExampleIntegration, "create_issue")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    def test_post_raises_issue_creation_exception_with_integration_installation_configuration_error(
        self, mock_record_failure: Any, mock_record_halt: Any, mock_create_issue: Any
    ) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"
        with self.feature("organizations:integrations-issue-basic"):
            mock_create_issue.side_effect = raise_integration_installation_configuration_error

            response = self.client.post(path, data={})
            assert response.status_code == 400

            self.assert_metric_recorded(
                mock_record_halt,
                IntegrationConfigurationError,
                "Repository has no issue tracker.",
            )

    def test_post_feature_disabled(self) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/"

        with self.feature(
            {
                "organizations:integrations-issue-basic": False,
                "organizations:integrations-issue-sync": False,
            }
        ):
            response = self.client.post(path, data={})
        assert response.status_code == 400
        assert response.data["detail"] == "Your organization does not have access to this feature."

    def test_simple_delete(self) -> None:
        self.organization.update_option("sentry:events_member_admin", False)
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        token = self.create_user_auth_token(user=member, scope_list=["event:write"])
        group = self.group
        integration = self.create_integration(
            organization=self.organization, provider="example", external_id="example:1"
        )
        external_issue = self.create_integration_external_issue(
            group=group, integration=integration, key="APP-123"
        )
        path = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/integrations/{integration.id}/?externalIssue={external_issue.id}"

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.delete(path, HTTP_AUTHORIZATION=f"Bearer {token.token}")

        assert response.status_code == 204, response.content
        assert not ExternalIssue.objects.filter(id=external_issue.id).exists()
        assert not GroupLink.objects.get_group_issues(group, external_issue.id).exists()
        assert Group.objects.get(id=group.id).status == group.status

    def test_delete_feature_disabled(self) -> None:
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

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

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/?externalIssue={external_issue.id}"

        with self.feature(
            {
                "organizations:integrations-issue-basic": False,
                "organizations:integrations-issue-sync": False,
            }
        ):
            response = self.client.delete(path)
        assert response.status_code == 400
        assert response.data["detail"] == "Your organization does not have access to this feature."

    def test_default_project(self) -> None:
        def assert_default_project(
            path: str, action: str, expected_project_field: dict[str, Any]
        ) -> None:
            response = self.client.get(path)
            assert response.status_code == 200
            if action == "create":
                fields = response.data["createIssueConfig"]
            else:
                fields = response.data["linkIssueConfig"]
            assert response.data["id"] == str(integration.id)
            for field in fields:
                if field["name"] == "project":
                    project_field = field
                    assert project_field == expected_project_field
                    break

        self.login_as(user=self.user)
        org = self.organization
        event = self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago.isoformat()},
            project_id=self.project.id,
        )
        assert event.group is not None
        group = event.group

        integration = self.create_integration(
            organization=org,
            provider="example",
            name="Example",
            external_id="example:1",
            oi_params={"config": {"project_issue_defaults": {group.project_id: {"project": "2"}}}},
        )
        create_path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/?action=create"
        link_path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/{integration.id}/?action=link"
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
