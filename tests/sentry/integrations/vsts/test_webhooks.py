from __future__ import absolute_import

import responses
from sentry.utils.compat.mock import patch
from time import time

from sentry.testutils import APITestCase
from sentry.models import (
    Activity,
    ExternalIssue,
    Group,
    GroupLink,
    GroupStatus,
    Identity,
    IdentityProvider,
    Integration,
)
from sentry.integrations.vsts.integration import VstsIntegration
from sentry.utils.http import absolute_uri
from .testutils import (
    WORK_ITEM_UPDATED,
    WORK_ITEM_UNASSIGNED,
    WORK_ITEM_UPDATED_STATUS,
    WORK_ITEM_STATES,
)


class VstsWebhookWorkItemTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.access_token = "1234567890"
        self.account_id = u"80ded3e8-3cd3-43b1-9f96-52032624aa3a"
        self.instance = "https://instance.visualstudio.com/"
        self.shared_secret = "1234567890"
        self.model = Integration.objects.create(
            provider="vsts",
            external_id=self.account_id,
            name="vsts_name",
            metadata={
                "domain_name": self.instance,
                "subscription": {"id": 1234, "secret": self.shared_secret},
            },
        )
        self.identity_provider = IdentityProvider.objects.create(type="vsts")
        self.identity = Identity.objects.create(
            idp=self.identity_provider,
            user=self.user,
            external_id="vsts_id",
            data={
                "access_token": self.access_token,
                "refresh_token": "qwertyuiop",
                "expires": int(time()) + int(1234567890),
            },
        )
        self.org_integration = self.model.add_organization(
            self.organization, self.user, self.identity.id
        )
        self.org_integration.config = {
            "sync_status_reverse": True,
            "sync_status_forward": True,
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
        }
        self.org_integration.save()
        self.integration = VstsIntegration(self.model, self.organization.id)

        self.user_to_assign = self.create_user("sentryuseremail@email.com")

    def tearDown(self):
        responses.reset()

    def create_linked_group(self, external_issue, project, status):
        group = self.create_group(project=project, status=status)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=project.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            data={},
        )
        return group

    def set_workitem_state(self, old_value, new_value):
        work_item = dict(WORK_ITEM_UPDATED_STATUS)
        state = work_item["resource"]["fields"]["System.State"]

        if old_value is None:
            del state["oldValue"]
        else:
            state["oldValue"] = old_value
        state["newValue"] = new_value

        return work_item

    @responses.activate
    def test_workitem_change_assignee(self):
        work_item_id = 31

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.model.id, key=work_item_id
        )
        with patch("sentry.integrations.vsts.webhooks.sync_group_assignee_inbound") as mock:
            resp = self.client.post(
                absolute_uri("/extensions/vsts/issue-updated/"),
                data=WORK_ITEM_UPDATED,
                HTTP_SHARED_SECRET=self.shared_secret,
            )

            assert resp.status_code == 200
            external_issue = ExternalIssue.objects.get(id=external_issue.id)
            assert mock.call_count == 1
            args = mock.call_args[1]

            assert args["integration"].__class__ == Integration
            assert args["email"] == "lauryn@sentry.io"
            assert args["external_issue_key"] == work_item_id
            assert args["assign"] is True

    @responses.activate
    def test_workitem_unassign(self):
        work_item_id = 33
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.model.id, key=work_item_id
        )
        with patch("sentry.integrations.vsts.webhooks.sync_group_assignee_inbound") as mock:
            resp = self.client.post(
                absolute_uri("/extensions/vsts/issue-updated/"),
                data=WORK_ITEM_UNASSIGNED,
                HTTP_SHARED_SECRET=self.shared_secret,
            )

            assert resp.status_code == 200
            external_issue = ExternalIssue.objects.get(id=external_issue.id)
            assert mock.call_count == 1
            args = mock.call_args[1]

            assert args["integration"].__class__ == Integration
            assert args["email"] is None
            assert args["external_issue_key"] == work_item_id
            assert args["assign"] is False

    @responses.activate
    def test_inbound_status_sync_resolve(self):
        responses.add(
            responses.GET,
            "https://instance.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workitemtypes/Bug/states",
            json=WORK_ITEM_STATES,
        )
        work_item_id = 33
        num_groups = 5
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.model.id, key=work_item_id
        )
        groups = [
            self.create_linked_group(external_issue, self.project, GroupStatus.UNRESOLVED)
            for _ in range(num_groups)
        ]

        # Change so that state is changing from unresolved to resolved
        work_item = self.set_workitem_state("Active", "Resolved")

        with self.feature("organizations:integrations-issue-sync"):
            resp = self.client.post(
                absolute_uri("/extensions/vsts/issue-updated/"),
                data=work_item,
                HTTP_SHARED_SECRET=self.shared_secret,
            )
            assert resp.status_code == 200
            group_ids = [g.id for g in groups]
            assert (
                len(Group.objects.filter(id__in=group_ids, status=GroupStatus.RESOLVED))
                == num_groups
            )
            assert len(Activity.objects.filter(group_id__in=group_ids)) == num_groups

    @responses.activate
    def test_inbound_status_sync_unresolve(self):
        responses.add(
            responses.GET,
            "https://instance.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workitemtypes/Bug/states",
            json=WORK_ITEM_STATES,
        )
        work_item_id = 33
        num_groups = 5
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.model.id, key=work_item_id
        )
        groups = [
            self.create_linked_group(external_issue, self.project, GroupStatus.RESOLVED)
            for _ in range(num_groups)
        ]

        # Change so that state is changing from resolved to unresolved
        work_item = self.set_workitem_state("Resolved", "Active")

        with self.feature("organizations:integrations-issue-sync"):
            resp = self.client.post(
                absolute_uri("/extensions/vsts/issue-updated/"),
                data=work_item,
                HTTP_SHARED_SECRET=self.shared_secret,
            )
            assert resp.status_code == 200
            group_ids = [g.id for g in groups]
            assert (
                len(Group.objects.filter(id__in=group_ids, status=GroupStatus.UNRESOLVED))
                == num_groups
            )
            assert len(Activity.objects.filter(group_id__in=group_ids)) == num_groups

    @responses.activate
    def test_inbound_status_sync_new_workitem(self):
        responses.add(
            responses.GET,
            "https://instance.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workitemtypes/Bug/states",
            json=WORK_ITEM_STATES,
        )
        work_item_id = 33
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.model.id, key=work_item_id
        )

        group = self.create_linked_group(external_issue, self.project, GroupStatus.UNRESOLVED)

        # Change so that it is a new workitem
        work_item = self.set_workitem_state(None, "New")
        assert "oldValue" not in work_item["resource"]["fields"]["System.State"]

        with self.feature("organizations:integrations-issue-sync"):
            resp = self.client.post(
                absolute_uri("/extensions/vsts/issue-updated/"),
                data=work_item,
                HTTP_SHARED_SECRET=self.shared_secret,
            )
            assert resp.status_code == 200
            assert Group.objects.get(id=group.id).status == GroupStatus.UNRESOLVED
            # no change happened. no activity should be created here
            assert len(Activity.objects.filter(group_id=group.id)) == 0
