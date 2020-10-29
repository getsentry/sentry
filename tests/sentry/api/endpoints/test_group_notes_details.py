from __future__ import absolute_import

import responses

from exam import fixture
from sentry.utils.compat.mock import patch

from sentry.models import Activity, ExternalIssue, Group, GroupLink, Integration
from sentry.testutils import APITestCase


class GroupNotesDetailsTest(APITestCase):
    def setUp(self):
        super(GroupNotesDetailsTest, self).setUp()
        self.activity.data["external_id"] = "123"
        self.activity.save()
        self.integration = Integration.objects.create(
            provider="example", external_id="example12345", name="Example 12345"
        )
        org_integration = self.integration.add_organization(self.organization)
        org_integration.config = {"sync_comments": True}
        org_integration.save()
        self.external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.integration.id, key="123"
        )
        GroupLink.objects.create(
            project_id=self.group.project_id,
            group_id=self.group.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=self.external_issue.id,
        )

    @fixture
    def url(self):
        return u"/api/0/issues/{}/comments/{}/".format(self.group.id, self.activity.id)

    def test_delete(self):
        self.login_as(user=self.user)

        url = self.url

        assert Group.objects.get(id=self.group.id).num_comments == 1

        response = self.client.delete(url, format="json")
        assert response.status_code == 204, response.status_code
        assert not Activity.objects.filter(id=self.activity.id).exists()

        assert Group.objects.get(id=self.group.id).num_comments == 0

    @patch("sentry.integrations.issues.IssueBasicMixin.update_comment")
    @responses.activate
    def test_put(self, mock_update_comment):
        self.login_as(user=self.user)

        url = self.url

        response = self.client.put(url, format="json")
        assert response.status_code == 400, response.content

        with self.tasks():
            with self.feature("organizations:integrations-issue-sync"):
                response = self.client.put(url, format="json", data={"text": "hi haters"})
        assert response.status_code == 200, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user == self.user
        assert activity.group == self.group
        assert activity.data == {"text": "hi haters", "external_id": "123"}

        assert mock_update_comment.call_count == 1
        assert mock_update_comment.call_args[0][0] == u"123"
        assert mock_update_comment.call_args[0][1] == self.user.id
        assert mock_update_comment.call_args[0][2] == activity

    @responses.activate
    def test_put_ignore_mentions(self):
        GroupLink.objects.filter(group_id=self.group.id).delete()
        self.login_as(user=self.user)

        with self.tasks():
            with self.feature("organizations:integrations-issue-sync"):
                response = self.client.put(
                    self.url,
                    format="json",
                    data={
                        "text": "hi **@{}**".format(self.user.username),
                        "mentions": ["user:{}".format(self.user.id)],
                    },
                )
        assert response.status_code == 200, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user == self.user
        assert activity.group == self.group
        assert activity.data == {
            "external_id": "123",
            "text": "hi **@{}**".format(self.user.username),
        }

    @patch("sentry.integrations.issues.IssueBasicMixin.update_comment")
    def test_put_no_external_id(self, mock_update_comment):
        del self.activity.data["external_id"]
        self.activity.save()
        self.login_as(user=self.user)

        url = self.url

        response = self.client.put(url, format="json")
        assert response.status_code == 400, response.content

        response = self.client.put(url, format="json", data={"text": "hi haters"})
        assert response.status_code == 200, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user == self.user
        assert activity.group == self.group
        assert activity.data == {"text": "hi haters"}

        assert mock_update_comment.call_count == 0
