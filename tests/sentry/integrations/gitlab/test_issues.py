from typing import int
import orjson
import pytest
import responses

from fixtures.gitlab import GitLabTestCase
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration import integration_service
from sentry.shared_integrations.exceptions import IntegrationError, IntegrationFormError
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils.http import absolute_uri

pytestmark = [requires_snuba]


class GitlabIssuesTest(GitLabTestCase):
    def setUp(self) -> None:
        super().setUp()
        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        self.group = event.group

    def test_make_external_key(self) -> None:
        project_name = "getsentry/sentry"
        issue_iid = "7"
        external_key = f"{project_name}#{issue_iid}"
        domain_name = self.installation.model.metadata["domain_name"]
        data = {"key": external_key}
        assert self.installation.make_external_key(data) == f"{domain_name}:{external_key}"

    def test_get_issue_url(self) -> None:
        issue_id = "example.gitlab.com:project/project#7"
        assert (
            self.installation.get_issue_url(issue_id)
            == "https://example.gitlab.com/project/project/issues/7"
        )

    @responses.activate
    def test_get_create_issue_config(self) -> None:
        group_description = (
            "Sentry Issue: [%s](%s)\n\n"
            "```\nStacktrace (most recent call first):\n\n"
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            "    string_max_length=self.string_max_length)\n\nmessage\n```"
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={"referrer": "gitlab_integration"})),
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/%s/projects"
            % self.installation.model.metadata["group_id"],
            json=[
                {"name_with_namespace": "getsentry / sentry", "id": 1},
                {"name_with_namespace": "getsentry / hello", "id": 22},
            ],
        )
        assert self.installation.get_create_issue_config(self.group, self.user) == [
            {
                "url": "/extensions/gitlab/search/baz/%d/" % self.installation.model.id,
                "name": "project",
                "required": True,
                "type": "select",
                "label": "GitLab Project",
                "choices": [(1, "getsentry / sentry"), (22, "getsentry / hello")],
                "defaultValue": 1,
            },
            {
                "name": "title",
                "label": "Title",
                "default": self.group.get_latest_event().title,
                "type": "string",
                "required": True,
            },
            {
                "name": "description",
                "label": "Description",
                "default": group_description,
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            },
        ]

    @responses.activate
    def test_get_link_issue_config(self) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/%s/projects"
            % self.installation.model.metadata["group_id"],
            json=[
                {"name_with_namespace": "getsentry / sentry", "id": 1},
                {"name_with_namespace": "getsentry / hello", "id": 22},
            ],
        )
        autocomplete_url = "/extensions/gitlab/search/baz/%d/" % self.installation.model.id
        assert self.installation.get_link_issue_config(self.group) == [
            {
                "name": "project",
                "label": "GitLab Project",
                "type": "select",
                "default": 1,
                "choices": [(1, "getsentry / sentry"), (22, "getsentry / hello")],
                "url": autocomplete_url,
                "updatesForm": True,
                "required": True,
            },
            {
                "name": "externalIssue",
                "label": "Issue",
                "default": "",
                "type": "select",
                "url": autocomplete_url,
                "required": True,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": "Sentry Issue: [{issue_id}]({url})".format(
                    url=absolute_uri(
                        self.group.get_absolute_url(params={"referrer": "gitlab_integration"})
                    ),
                    issue_id=self.group.qualified_short_id,
                ),
                "type": "textarea",
                "required": False,
                "help": ("Leave blank if you don't want to " "add a comment to the GitLab issue."),
            },
        ]

    @responses.activate
    def test_create_issue(self) -> None:
        issue_iid = "1"
        project_id = "10"
        project_name = "getsentry/sentry"
        key = f"{project_name}#{issue_iid}"
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/%s/issues" % project_id,
            json={
                "id": 8,
                "iid": issue_iid,
                "title": "hello",
                "description": "This is the description",
                "web_url": f"https://example.gitlab.com/{project_name}/issues/{issue_iid}",
            },
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s" % project_id,
            json={"path_with_namespace": project_name, "id": 10},
        )
        form_data = {
            "project": project_id,
            "title": "hello",
            "description": "This is the description",
        }

        assert self.installation.create_issue(form_data) == {
            "key": key,
            "description": "This is the description",
            "title": "hello",
            "url": f"https://example.gitlab.com/{project_name}/issues/{issue_iid}",
            "project": project_id,
            "metadata": {"display_name": key},
        }

    @responses.activate
    def test_get_issue(self) -> None:
        project_id = "12"
        project_name = "getsentry/sentry"
        issue_iid = "13"
        key = f"{project_name}#{issue_iid}"
        responses.add(
            responses.GET,
            f"https://example.gitlab.com/api/v4/projects/{project_id}/issues/{issue_iid}",
            json={
                "id": 18,
                "iid": issue_iid,
                "title": "hello",
                "description": "This is the description",
                "web_url": f"https://example.gitlab.com/{project_name}/issues/{issue_iid}",
            },
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s" % project_id,
            json={"id": project_id, "path_with_namespace": project_name},
        )

        assert self.installation.get_issue(issue_id=f"{project_id}#{issue_iid}", data={}) == {
            "key": key,
            "description": "This is the description",
            "title": "hello",
            "url": f"https://example.gitlab.com/{project_name}/issues/{issue_iid}",
            "project": project_id,
            "metadata": {"display_name": key},
        }

    @responses.activate
    def test_create_issue_default_project_in_group_api_call(self) -> None:
        group_description = (
            "Sentry Issue: [%s](%s)\n\n"
            "```\nStacktrace (most recent call first):\n\n"
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            "    string_max_length=self.string_max_length)\n\nmessage\n```"
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={"referrer": "gitlab_integration"})),
        )
        project_id = 10
        project_name = "This_is / a_project"
        assert self.installation.org_integration is not None
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.installation.org_integration.id,
            config={
                "project_issue_defaults": {str(self.group.project_id): {"project": project_id}}
            },
        )
        assert org_integration is not None
        self.installation.org_integration = org_integration

        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/%s/projects"
            % self.installation.model.metadata["group_id"],
            json=[
                {"name_with_namespace": "getsentry / sentry", "id": 1},
                {"name_with_namespace": project_name, "id": project_id},
                {"name_with_namespace": "getsentry / hello", "id": 22},
            ],
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s" % project_id,
            json={"path_with_namespace": project_name, "id": project_id},
        )
        assert self.installation.get_create_issue_config(self.group, self.user) == [
            {
                "url": "/extensions/gitlab/search/baz/%d/" % self.installation.model.id,
                "name": "project",
                "required": True,
                "choices": [
                    (1, "getsentry / sentry"),
                    (10, "This_is / a_project"),
                    (22, "getsentry / hello"),
                ],
                "defaultValue": project_id,
                "type": "select",
                "label": "GitLab Project",
            },
            {
                "name": "title",
                "label": "Title",
                "default": self.group.get_latest_event().title,
                "type": "string",
                "required": True,
            },
            {
                "name": "description",
                "label": "Description",
                "default": group_description,
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            },
        ]

    @responses.activate
    def test_create_issue_default_project_not_in_api_call(self) -> None:
        group_description = (
            "Sentry Issue: [%s](%s)\n\n"
            "```\nStacktrace (most recent call first):\n\n"
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            "    string_max_length=self.string_max_length)\n\nmessage\n```"
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={"referrer": "gitlab_integration"})),
        )
        project_id = 10
        project_name = "This_is / a_project"
        assert self.installation.org_integration is not None
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.installation.org_integration.id,
            config={
                "project_issue_defaults": {str(self.group.project_id): {"project": project_id}}
            },
        )
        assert org_integration is not None
        self.installation.org_integration = org_integration

        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/%s/projects"
            % self.installation.model.metadata["group_id"],
            json=[
                {"name_with_namespace": "getsentry / sentry", "id": 1},
                {"name_with_namespace": "getsentry / hello", "id": 22},
            ],
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s" % project_id,
            json={"name_with_namespace": project_name, "id": project_id},
        )
        assert self.installation.get_create_issue_config(self.group, self.user) == [
            {
                "url": "/extensions/gitlab/search/baz/%d/" % self.installation.model.id,
                "name": "project",
                "required": True,
                "choices": [
                    (10, "This_is / a_project"),
                    (1, "getsentry / sentry"),
                    (22, "getsentry / hello"),
                ],
                "defaultValue": project_id,
                "type": "select",
                "label": "GitLab Project",
            },
            {
                "name": "title",
                "label": "Title",
                "default": self.group.get_latest_event().title,
                "type": "string",
                "required": True,
            },
            {
                "name": "description",
                "label": "Description",
                "default": group_description,
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            },
        ]

    @responses.activate
    def test_create_issue_no_projects(self) -> None:
        group_description = (
            "Sentry Issue: [%s](%s)\n\n"
            "```\nStacktrace (most recent call first):\n\n"
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            "    string_max_length=self.string_max_length)\n\nmessage\n```"
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={"referrer": "gitlab_integration"})),
        )

        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/%s/projects"
            % self.installation.model.metadata["group_id"],
            json=[],
        )
        assert self.installation.get_create_issue_config(self.group, self.user) == [
            {
                "url": "/extensions/gitlab/search/baz/%d/" % self.installation.model.id,
                "name": "project",
                "required": True,
                "choices": [],
                "defaultValue": "",
                "type": "select",
                "label": "GitLab Project",
            },
            {
                "name": "title",
                "label": "Title",
                "default": self.group.get_latest_event().title,
                "type": "string",
                "required": True,
            },
            {
                "name": "description",
                "label": "Description",
                "default": group_description,
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            },
        ]

    @responses.activate
    def test_after_link_issue(self) -> None:
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/2/issues/321/notes",
            json=[],
        )
        data = {"externalIssue": "2#321", "comment": "This is not good."}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.integration.id, key="2#321"
        )
        self.installation.after_link_issue(external_issue, data=data)

    @responses.activate
    def test_after_link_issue_required_fields(self) -> None:
        data = {"externalIssue": "2#231", "comment": "This is not good."}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.integration.id, key="#"
        )
        with pytest.raises(IntegrationError):
            self.installation.after_link_issue(external_issue, data=data)

    @responses.activate
    def test_after_link_issue_failure(self) -> None:
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/2/issues/321/notes",
            status=502,
        )
        data = {"externalIssue": "2#321", "comment": "This is not good."}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.integration.id, key="2#321"
        )
        with pytest.raises(IntegrationError):
            self.installation.after_link_issue(external_issue, data=data)

    @responses.activate
    def test_create_issue_missing_title(self) -> None:
        """Test that an error is raised when title is missing"""
        project_id = "10"
        data_without_title = {
            "project": project_id,
            "description": "This is a test issue description",
        }

        with pytest.raises(IntegrationFormError):
            self.installation.create_issue(data_without_title)

        assert len(responses.calls) == 0

    @responses.activate
    def test_create_issue_title_too_long(self) -> None:
        """Test that title is truncated when it exceeds max length"""
        project_id = "10"
        project_name = "getsentry/sentry"
        issue_iid = "1"

        long_title = "A" * 300  # Title longer than GITLAB_ISSUE_TITLE_MAX_LENGTH (255)
        expected_truncated_title = "A" * 252 + "..."  # 255 - 3 chars for ellipsis

        data_with_long_title = {
            "project": project_id,
            "title": long_title,
            "description": "This is a test issue description",
        }

        responses.add(
            responses.POST,
            f"https://example.gitlab.com/api/v4/projects/{project_id}/issues",
            json={
                "id": 8,
                "iid": issue_iid,
                "title": expected_truncated_title,
                "description": "This is a test issue description",
                "web_url": f"https://example.gitlab.com/{project_name}/issues/{issue_iid}",
            },
            status=201,
        )

        responses.add(
            responses.GET,
            f"https://example.gitlab.com/api/v4/projects/{project_id}",
            json={"path_with_namespace": project_name, "id": int(project_id)},
        )

        result = self.installation.create_issue(data_with_long_title)

        assert len(responses.calls) == 2
        request_data = orjson.loads(responses.calls[0].request.body)
        assert request_data["title"] == expected_truncated_title
        assert len(request_data["title"]) == 255

        assert result["title"] == expected_truncated_title

    @responses.activate
    def test_create_issue_api_error(self) -> None:
        """Test handling of API errors during issue creation"""
        project_id = "10"
        error_response = {"message": "Project not found"}

        responses.add(
            responses.POST,
            f"https://example.gitlab.com/api/v4/projects/{project_id}/issues",
            json=error_response,
            status=404,
        )

        with pytest.raises(IntegrationError):
            self.installation.create_issue(
                {
                    "project": project_id,
                    "title": "Test Issue Title",
                    "description": "This is a test issue description",
                }
            )

        assert len(responses.calls) == 1
        assert responses.calls[0].response.status_code == 404

    @responses.activate
    def test_create_issue_missing_project(self) -> None:
        """Test that an error is raised when project is missing"""
        with pytest.raises(IntegrationError) as excinfo:
            self.installation.create_issue(
                {
                    "title": "Test Issue Title",
                    "description": "This is a test issue description",
                }
            )

        assert "project kwarg must be provided" in str(excinfo.value)
        assert len(responses.calls) == 0
