from __future__ import absolute_import

import copy
import responses
import six

from sentry.integrations.bitbucket.issues import ISSUE_TYPES, PRIORITIES
from sentry.models import ExternalIssue, Integration
from sentry.testutils import APITestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils import json


class BitbucketIssueTest(APITestCase):
    def setUp(self):
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.integration = Integration.objects.create(
            provider="bitbucket",
            external_id=self.subject,
            name="myaccount",
            metadata={
                "base_url": self.base_url,
                "shared_secret": self.shared_secret,
                "subject": self.subject,
            },
        )
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=self.project.id,
        )
        self.group = event.group
        self.repo_choices = [
            ("myaccount/repo1", "myaccount/repo1"),
            ("myaccount/repo2", "myaccount/repo2"),
        ]
        self.org_integration = self.integration.add_organization(self.organization)

    def build_autocomplete_url(self):
        return "/extensions/bitbucket/search/baz/%d/" % self.integration.id

    @responses.activate
    def test_link_issue(self):
        issue_id = 3
        repo = "myaccount/myrepo"
        responses.add(
            responses.GET,
            u"https://api.bitbucket.org/2.0/repositories/{repo}/issues/{issue_id}".format(
                repo=repo, issue_id=issue_id
            ),
            json={"id": issue_id, "title": "hello", "content": {"html": "This is the description"}},
        )

        data = {"repo": repo, "externalIssue": issue_id, "comment": "hello"}

        assert self.integration.get_installation(None).get_issue(issue_id, data=data) == {
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
            u"https://api.bitbucket.org/2.0/repositories/{repo}/issues/{issue_id}/comments".format(
                repo=repo, issue_id=issue_id
            ),
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
        payload = json.loads(request.body)
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
        self.org_integration.config = {
            "project_issue_defaults": {
                six.text_type(self.group.project_id): {"repo": "myaccount/repo1"}
            }
        }
        self.org_integration.save()
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
        self.org_integration.config = {
            "project_issue_defaults": {
                six.text_type(self.group.project_id): {"repo": "myaccount/repo1"}
            }
        }
        self.org_integration.save()
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
                "default": u"message",
                "type": "string",
                "required": True,
            },
            {
                "name": "description",
                "label": "Description",
                "default": u'Sentry Issue: [BAR-1](http://testserver/organizations/baz/issues/%d/?referrer=bitbucket_integration)\n\n```\nStacktrace (most recent call first):\n\n  File "sentry/models/foo.py", line 29, in build_msg\n    string_max_length=self.string_max_length)\n\nmessage\n```'
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
            u"https://api.bitbucket.org/2.0/repositories/{repo}/issues".format(repo=repo),
            json={"id": id, "title": title, "content": {"html": content}},
        )
        installation = self.integration.get_installation(self.organization.id)
        result = installation.create_issue(
            {"id": id, "title": title, "description": content, "repo": repo}
        )
        assert result == {"key": id, "title": title, "description": content, "repo": repo}
