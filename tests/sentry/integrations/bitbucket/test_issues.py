import orjson
import responses

from sentry.integrations.bitbucket.issues import ISSUE_TYPES, PRIORITIES
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration import integration_service
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class BitbucketIssueTest(APITestCase):
    def setUp(self):
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.integration = self.create_integration(
            organization=self.organization,
            provider="bitbucket",
            external_id=self.subject,
            name="myaccount",
            metadata={
                "base_url": self.base_url,
                "shared_secret": self.shared_secret,
                "subject": self.subject,
            },
        )
        org_integration = integration_service.get_organization_integration(
            integration_id=self.integration.id, organization_id=self.organization.id
        )
        assert org_integration is not None
        self.org_integration = org_integration
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
        self.repo_choices = [
            ("myaccount/repo1", "myaccount/repo1"),
            ("myaccount/repo2", "myaccount/repo2"),
        ]

    def build_autocomplete_url(self):
        return "/extensions/bitbucket/search/baz/%d/" % self.integration.id

    @responses.activate
    def test_link_issue(self):
        issue_id = 3
        repo = "myaccount/myrepo"
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/{repo}/issues/{issue_id}",
            json={"id": issue_id, "title": "hello", "content": {"html": "This is the description"}},
        )

        data = {"repo": repo, "externalIssue": issue_id, "comment": "hello"}

        assert self.integration.get_installation(self.organization.id).get_issue(
            issue_id, data=data
        ) == {
            "key": issue_id,
            "description": "This is the description",
            "title": "hello",
            "repo": repo,
        }

    @responses.activate
    def test_after_link_issue(self):
        issue_id = 3
        repo = "myaccount/myrepo"
        comment = {"comment": "hello I'm a comment"}
        responses.add(
            responses.POST,
            f"https://api.bitbucket.org/2.0/repositories/{repo}/issues/{issue_id}/comments",
            status=201,
            json={"content": {"raw": comment}},
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="%s#%d" % (repo, issue_id),
        )

        self.integration.get_installation(external_issue.organization_id).after_link_issue(
            external_issue, data=comment
        )

        request = responses.calls[0].request
        assert responses.calls[0].response.status_code == 201
        payload = orjson.loads(request.body)
        assert payload == {"content": {"raw": comment["comment"]}}

    @responses.activate
    def test_default_repo_link_fields(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount",
            body=b"""{
                "values": [
                    {"full_name": "myaccount/repo1"},
                    {"full_name": "myaccount/repo2"}
                ]
            }""",
            content_type="application/json",
        )
        integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config={
                "project_issue_defaults": {str(self.group.project_id): {"repo": "myaccount/repo1"}}
            },
        )
        installation = self.integration.get_installation(self.organization.id)
        fields = installation.get_link_issue_config(self.group)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assert repo_field["default"] == "myaccount/repo1"

    @responses.activate
    def test_default_repo_create_fields(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount",
            body=b"""{
                "values": [
                    {"full_name": "myaccount/repo1"},
                    {"full_name": "myaccount/repo2"}
                ]
            }""",
            content_type="application/json",
        )
        integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config={
                "project_issue_defaults": {str(self.group.project_id): {"repo": "myaccount/repo1"}}
            },
        )
        installation = self.integration.get_installation(self.organization.id)
        fields = installation.get_create_issue_config(self.group, self.user)
        for field in fields:
            if field["name"] == "repo":
                repo_field = field
                break
        assert repo_field["default"] == "myaccount/repo1"

    @responses.activate
    def test_default_repo_link_fields_no_repos(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount",
            body=b"""{
                "values": []
            }""",
            content_type="application/json",
        )

        installation = self.integration.get_installation(self.organization.id)
        fields = installation.get_link_issue_config(self.group)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assert repo_field["default"] == ""
        assert repo_field["choices"] == []

    @responses.activate
    def test_default_repo_create_fields_no_repos(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount",
            body=b"""{
                "values": []
            }""",
            content_type="application/json",
        )

        installation = self.integration.get_installation(self.organization.id)
        fields = installation.get_create_issue_config(self.group, self.user)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assert repo_field["default"] == ""
        assert repo_field["choices"] == []

    @responses.activate
    def test_get_create_issue_config(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount",
            json={"values": [{"full_name": "myaccount/repo1"}, {"full_name": "myaccount/repo2"}]},
        )

        installation = self.integration.get_installation(self.organization.id)
        assert installation.get_create_issue_config(self.group, self.user) == [
            {
                "name": "repo",
                "required": True,
                "updatesForm": True,
                "type": "select",
                "url": self.build_autocomplete_url(),
                "choices": self.repo_choices,
                "default": self.repo_choices[0][0],
                "label": "Bitbucket Repository",
            },
            {
                "name": "title",
                "label": "Title",
                "default": "message",
                "type": "string",
                "required": True,
            },
            {
                "name": "description",
                "label": "Description",
                "default": 'Sentry Issue: [BAR-1](http://testserver/organizations/baz/issues/%d/?referrer=bitbucket_integration)\n\n```\nStacktrace (most recent call first):\n\n  File "sentry/models/foo.py", line 29, in build_msg\n    string_max_length=self.string_max_length)\n\nmessage\n```'
                % self.group.id,
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            },
            {
                "name": "issue_type",
                "label": "Issue type",
                "default": ISSUE_TYPES[0][0],
                "type": "select",
                "choices": ISSUE_TYPES,
            },
            {
                "name": "priority",
                "label": "Priority",
                "default": PRIORITIES[0][0],
                "type": "select",
                "choices": PRIORITIES,
            },
        ]

    @responses.activate
    def test_get_create_issue_config_without_group(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount",
            json={
                "values": [
                    {"full_name": "myaccount/repo1"},
                    {"full_name": "myaccount/repo2"},
                ],
            },
        )

        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount/issues/labels",
            json=[
                {"name": "bug"},
                {"name": "not-bug"},
            ],
        )

        installation = self.integration.get_installation(self.organization.id)
        config = installation.get_create_issue_config(None, self.user, params={})
        [repo_field, assignee_field, label_field] = config
        assert repo_field["name"] == "repo"
        assert repo_field["type"] == "select"
        assert repo_field["label"] == "Bitbucket Repository"
        assert label_field["name"] == "priority"
        assert label_field["type"] == "select"
        assert label_field["label"] == "Priority"

    @responses.activate
    def test_get_link_issue_config(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/myaccount",
            json={"values": [{"full_name": "myaccount/repo1"}, {"full_name": "myaccount/repo2"}]},
        )
        installation = self.integration.get_installation(self.organization.id)
        assert installation.get_link_issue_config(self.group) == [
            {
                "name": "repo",
                "required": True,
                "updatesForm": True,
                "type": "select",
                "url": self.build_autocomplete_url(),
                "choices": self.repo_choices,
                "default": self.repo_choices[0][0],
                "label": "Bitbucket Repository",
            },
            {
                "name": "externalIssue",
                "label": "Issue",
                "default": "",
                "type": "select",
                "required": True,
                "url": self.build_autocomplete_url(),
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": "",
                "type": "textarea",
                "required": False,
                "help": (
                    "Leave blank if you don't want to " "add a comment to the Bitbucket issue."
                ),
            },
        ]

    @responses.activate
    def test_create_issue(self):
        repo = "myaccount/repo1"
        id = "112"
        title = "hello"
        content = {"html": "This is the description"}

        responses.add(
            responses.POST,
            f"https://api.bitbucket.org/2.0/repositories/{repo}/issues",
            json={"id": id, "title": title, "content": {"html": content}},
        )
        installation = self.integration.get_installation(self.organization.id)
        result = installation.create_issue(
            {"id": id, "title": title, "description": content, "repo": repo}
        )
        assert result == {"key": id, "title": title, "description": content, "repo": repo}
