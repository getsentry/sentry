from functools import cached_property
from unittest.mock import patch

import responses

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.models.integrations.integration import Integration
from sentry.notifications.types import GroupSubscriptionReason
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.types.activity import ActivityType


@region_silo_test
class GroupNotesDetailsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.activity.data["external_id"] = "123"
        self.activity.save()

        with assume_test_silo_mode(SiloMode.CONTROL):
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

    @cached_property
    def url(self):
        return f"/api/0/issues/{self.group.id}/comments/{self.activity.id}/"

    def test_delete(self):
        self.login_as(user=self.user)

        url = self.url

        assert Group.objects.get(id=self.group.id).num_comments == 1

        response = self.client.delete(url, format="json")
        assert response.status_code == 204, response.status_code
        assert not Activity.objects.filter(id=self.activity.id).exists()

        assert Group.objects.get(id=self.group.id).num_comments == 0

    def test_delete_comment_and_subscription(self):
        """Test that if a user deletes their comment on an issue, we delete the subscription too"""
        self.login_as(user=self.user)
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group: Group = event.group

        # create a comment
        comment_url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.post(comment_url, format="json", data={"text": "hi haters"})
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.filter(
            group=group,
            project=group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.comment,
        ).exists()
        activity = Activity.objects.get(
            group=group, type=ActivityType.NOTE.value, user_id=self.user.id
        )

        url = f"/api/0/issues/{group.id}/comments/{activity.id}/"
        response = self.client.delete(url, format="json")

        assert response.status_code == 204, response.status_code
        assert not GroupSubscription.objects.filter(
            group=group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.comment,
        ).exists()

    def test_delete_multiple_comments(self):
        """Test that if a user has commented multiple times on an issue and deletes one, we don't remove the subscription"""
        self.login_as(user=self.user)
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group: Group = event.group

        # create a comment
        comment_url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.post(comment_url, format="json", data={"text": "hi haters"})
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.filter(
            group=group,
            project=group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.comment,
        ).exists()

        # create another comment that we'll delete
        response = self.client.post(comment_url, format="json", data={"text": "bye haters"})
        assert response.status_code == 201, response.content

        activity = Activity.objects.filter(
            group=group, type=ActivityType.NOTE.value, user_id=self.user.id
        ).first()

        url = f"/api/0/issues/{group.id}/comments/{activity.id}/"
        response = self.client.delete(url, format="json")

        assert response.status_code == 204, response.status_code
        assert GroupSubscription.objects.filter(
            group=group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.comment,
        ).exists()

    @patch("sentry.integrations.mixins.IssueBasicMixin.update_comment")
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
        assert activity.user_id == self.user.id
        assert activity.group == self.group
        assert activity.data == {"text": "hi haters", "external_id": "123"}

        assert mock_update_comment.call_count == 1
        assert mock_update_comment.call_args[0][0] == "123"
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
                        "text": f"hi **@{self.user.username}**",
                        "mentions": [f"user:{self.user.id}"],
                    },
                )
        assert response.status_code == 200, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user_id == self.user.id
        assert activity.group == self.group
        assert activity.data == {
            "external_id": "123",
            "text": f"hi **@{self.user.username}**",
        }

    @patch("sentry.integrations.mixins.IssueBasicMixin.update_comment")
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
        assert activity.user_id == self.user.id
        assert activity.group == self.group
        assert activity.data == {"text": "hi haters"}

        assert mock_update_comment.call_count == 0
