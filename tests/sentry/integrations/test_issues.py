from __future__ import absolute_import

import six

from sentry.models import (
    ExternalIssue,
    Group,
    GroupStatus,
    GroupLink,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import TestCase


class IssueSyncIntegration(TestCase):
    def test_status_sync_inbound_resolve(self):
        group = self.group
        assert group.status == GroupStatus.UNRESOLVED

        integration = Integration.objects.create(provider="example", external_id="123456")
        integration.add_organization(group.organization, self.user)

        OrganizationIntegration.objects.filter(
            integration_id=integration.id, organization_id=group.organization.id
        ).update(
            config={
                "sync_comments": True,
                "sync_status_outbound": True,
                "sync_status_inbound": True,
                "sync_assignee_outbound": True,
                "sync_assignee_inbound": True,
            }
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        installation = integration.get_installation(group.organization.id)

        with self.feature("organizations:integrations-issue-sync"):
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "done"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

    def test_status_sync_inbound_unresolve(self):
        group = self.group
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.status == GroupStatus.RESOLVED

        integration = Integration.objects.create(provider="example", external_id="123456")
        integration.add_organization(group.organization, self.user)

        OrganizationIntegration.objects.filter(
            integration_id=integration.id, organization_id=group.organization.id
        ).update(
            config={
                "sync_comments": True,
                "sync_status_outbound": True,
                "sync_status_inbound": True,
                "sync_assignee_outbound": True,
                "sync_assignee_inbound": True,
            }
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        installation = integration.get_installation(group.organization.id)

        with self.feature("organizations:integrations-issue-sync"):
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "in_progress"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.UNRESOLVED


class IssueDefaultTest(TestCase):
    def setUp(self):
        self.group.status = GroupStatus.RESOLVED
        self.group.save()

        integration = Integration.objects.create(provider="example", external_id="123456")
        integration.add_organization(self.group.organization, self.user)

        self.external_issue = ExternalIssue.objects.create(
            organization_id=self.group.organization.id, integration_id=integration.id, key="APP-123"
        )

        self.group_link = GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=self.external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        self.installation = integration.get_installation(self.group.organization.id)

    def test_get_repository_choices(self):
        default_repo, repo_choice = self.installation.get_repository_choices(self.group)
        assert default_repo == "user/repo"
        assert repo_choice == [("user/repo", "repo")]

    def test_get_repository_choices_no_repos(self):
        self.installation.get_repositories = lambda: []
        default_repo, repo_choice = self.installation.get_repository_choices(self.group)
        assert default_repo == ""
        assert repo_choice == []

    def test_get_repository_choices_default_repo(self):
        self.installation.org_integration.config = {
            "project_issue_defaults": {six.text_type(self.group.project_id): {"repo": "user/repo2"}}
        }
        self.installation.org_integration.save()
        self.installation.get_repositories = lambda: [
            {"name": "repo1", "identifier": "user/repo1"},
            {"name": "repo2", "identifier": "user/repo2"},
        ]
        default_repo, repo_choice = self.installation.get_repository_choices(self.group)
        assert default_repo == "user/repo2"
        assert repo_choice == [("user/repo1", "repo1"), ("user/repo2", "repo2")]

    def test_store_issue_last_defaults_partial_update(self):
        assert "project" in self.installation.get_persisted_default_config_fields()
        assert "issueType" in self.installation.get_persisted_default_config_fields()
        self.installation.store_issue_last_defaults(1, {"project": "xyz", "issueType": "BUG"})
        self.installation.store_issue_last_defaults(1, {"issueType": "FEATURE"})
        # {} is commonly triggered by "link issue" flow
        self.installation.store_issue_last_defaults(1, {})
        assert self.installation.get_project_defaults(1) == {
            "project": "xyz",
            "issueType": "FEATURE",
        }

    def test_store_issue_last_defaults_multiple_projects(self):
        assert "project" in self.installation.get_persisted_default_config_fields()
        self.installation.store_issue_last_defaults(1, {"project": "xyz"})
        self.installation.store_issue_last_defaults(2, {"project": "abc"})
        assert self.installation.get_project_defaults(1) == {"project": "xyz"}
        assert self.installation.get_project_defaults(2) == {"project": "abc"}

    def test_annotations(self):
        label = self.installation.get_issue_display_name(self.external_issue)
        link = self.installation.get_issue_url(self.external_issue.key)

        assert self.installation.get_annotations_for_group_list([self.group]) == {
            self.group.id: ['<a href="%s">%s</a>' % (link, label)]
        }

        integration = Integration.objects.create(provider="example", external_id="4444")
        integration.add_organization(self.group.organization, self.user)
        installation = integration.get_installation(self.group.organization.id)

        assert installation.get_annotations_for_group_list([self.group]) == {self.group.id: []}
