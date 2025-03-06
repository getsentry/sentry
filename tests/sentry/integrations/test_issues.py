from unittest import mock

from sentry.integrations.example.integration import AliasedIntegrationProvider, ExampleIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType


class IssueSyncIntegration(TestCase):
    def test_status_sync_inbound_resolve(self):
        group = self.group
        assert group.status == GroupStatus.UNRESOLVED

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", external_id="123456")
            integration.add_organization(group.organization, self.user)

            for oi in OrganizationIntegration.objects.filter(
                integration_id=integration.id, organization_id=group.organization.id
            ):
                oi.update(
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
        assert isinstance(installation, ExampleIntegration)

        with self.feature("organizations:integrations-issue-sync"), self.tasks():
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "done"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
            activity = Activity.objects.get(group_id=group.id, type=ActivityType.SET_RESOLVED.value)
            assert activity.data == {
                "integration_id": integration.id,
                "provider": integration.get_provider().name,
                "provider_key": integration.get_provider().key,
            }

    def test_sync_status_resolve_in_next_release_no_releases(self):
        group = self.group
        assert group.status == GroupStatus.UNRESOLVED

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", external_id="123456")
            integration.add_organization(group.organization, self.user)

            for oi in OrganizationIntegration.objects.filter(
                integration_id=integration.id, organization_id=group.organization.id
            ):
                oi.update(
                    config={
                        "sync_comments": True,
                        "sync_status_outbound": True,
                        "sync_status_inbound": True,
                        "sync_assignee_outbound": True,
                        "sync_assignee_inbound": True,
                        "resolution_strategy": "resolve_next_release",
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
        assert isinstance(installation, ExampleIntegration)

        with self.feature("organizations:integrations-issue-sync"), self.tasks():
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "done"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
            activity = Activity.objects.get(group_id=group.id, type=ActivityType.SET_RESOLVED.value)
            assert activity.data == {
                "integration_id": integration.id,
                "provider": integration.get_provider().name,
                "provider_key": integration.get_provider().key,
            }

    def test_sync_status_resolve_in_next_release_with_releases(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release2 = Release.objects.create(organization_id=self.project.organization_id, version="b")
        release.add_project(self.project)
        release2.add_project(self.project)
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        # add releases in the reverse order
        self.create_group_release(group=group, release=release2)
        self.create_group_release(group=group, release=release)

        assert group.status == GroupStatus.UNRESOLVED

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", external_id="123456")
            integration.add_organization(group.organization, self.user)

            for oi in OrganizationIntegration.objects.filter(
                integration_id=integration.id, organization_id=group.organization.id
            ):
                oi.update(
                    config={
                        "sync_comments": True,
                        "sync_status_outbound": True,
                        "sync_status_inbound": True,
                        "sync_assignee_outbound": True,
                        "sync_assignee_inbound": True,
                        "resolution_strategy": "resolve_next_release",
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
        assert isinstance(installation, ExampleIntegration)

        with self.feature("organizations:integrations-issue-sync"), self.tasks():
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "done"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
            activity = Activity.objects.get(
                group_id=group.id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            )
            assert GroupResolution.objects.filter(
                group=group,
                current_release_version=release.version,
                release=release2,
                type=GroupResolution.Type.in_next_release,
            ).exists()
            assert activity.data == {
                "integration_id": integration.id,
                "provider": integration.get_provider().name,
                "provider_key": integration.get_provider().key,
                "inNextRelease": True,
                "version": release2.version,
            }

    def test_sync_status_does_not_override_existing_recent_group_resolution(self):
        """
        Test that the sync_status_inbound does not override the existing group resolution
        if the group was recently resolved
        """
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release2 = Release.objects.create(organization_id=self.project.organization_id, version="b")
        release.add_project(self.project)
        release2.add_project(self.project)
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        # add releases in the reverse order
        self.create_group_release(group=group, release=release2)
        self.create_group_release(group=group, release=release)

        assert group.status == GroupStatus.UNRESOLVED

        # Resolve the group in old_release
        group.update(status=GroupStatus.RESOLVED, substatus=None)
        resolution = GroupResolution.objects.create(release=release, group=group)
        assert resolution.current_release_version is None
        assert resolution.release == release
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution.id,
            data={"version": release.version},
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", external_id="123456")
            integration.add_organization(group.organization, self.user)

            for oi in OrganizationIntegration.objects.filter(
                integration_id=integration.id, organization_id=group.organization.id
            ):
                oi.update(
                    config={
                        "sync_comments": True,
                        "sync_status_outbound": True,
                        "sync_status_inbound": True,
                        "sync_assignee_outbound": True,
                        "sync_assignee_inbound": True,
                        "resolution_strategy": "resolve_next_release",
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
        assert isinstance(installation, ExampleIntegration)

        with self.feature("organizations:integrations-issue-sync"), self.tasks():
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "done"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
            resolution.refresh_from_db()
            assert resolution.release == release
            assert resolution.current_release_version is None
            activity.refresh_from_db()
            assert activity.data["version"] == release.version

    def test_sync_status_resolve_in_next_release_with_semver(self):
        release = Release.objects.create(
            organization_id=self.project.organization_id, version="app@1.2.4"
        )
        release2 = Release.objects.create(
            organization_id=self.project.organization_id, version="app@1.2.3"
        )
        release.add_project(self.project)
        release2.add_project(self.project)
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        self.create_group_release(group=group, release=release)
        self.create_group_release(group=group, release=release2)

        assert group.status == GroupStatus.UNRESOLVED

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", external_id="123456")
            integration.add_organization(group.organization, self.user)

            for oi in OrganizationIntegration.objects.filter(
                integration_id=integration.id, organization_id=group.organization.id
            ):
                oi.update(
                    config={
                        "sync_comments": True,
                        "sync_status_outbound": True,
                        "sync_status_inbound": True,
                        "sync_assignee_outbound": True,
                        "sync_assignee_inbound": True,
                        "resolution_strategy": "resolve_next_release",
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
        assert isinstance(installation, ExampleIntegration)

        with self.feature("organizations:integrations-issue-sync"), self.tasks():
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "done"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
            activity = Activity.objects.get(
                group_id=group.id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            )
            assert GroupResolution.objects.filter(
                group=group,
                current_release_version=release.version,
                release=release2,
                type=GroupResolution.Type.in_next_release,
            ).exists()
            assert activity.data == {
                "integration_id": integration.id,
                "provider": integration.get_provider().name,
                "provider_key": integration.get_provider().key,
                "inNextRelease": True,
                "current_release_version": "app@1.2.4",
            }

    def test_sync_status_resolve_in_current_release_with_releases(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        self.create_group_release(group=group, release=release)

        assert group.status == GroupStatus.UNRESOLVED

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", external_id="123456")
            integration.add_organization(group.organization, self.user)

            for oi in OrganizationIntegration.objects.filter(
                integration_id=integration.id, organization_id=group.organization.id
            ):
                oi.update(
                    config={
                        "sync_comments": True,
                        "sync_status_outbound": True,
                        "sync_status_inbound": True,
                        "sync_assignee_outbound": True,
                        "sync_assignee_inbound": True,
                        "resolution_strategy": "resolve_current_release",
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
        assert isinstance(installation, ExampleIntegration)

        with self.feature("organizations:integrations-issue-sync"), self.tasks():
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "done"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
            activity = Activity.objects.get(
                group_id=group.id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            )
            assert GroupResolution.objects.filter(
                group=group,
                current_release_version=None,
                release=release,
                type=GroupResolution.Type.in_release,
            ).exists()
            assert activity.data == {
                "integration_id": integration.id,
                "provider": integration.get_provider().name,
                "provider_key": integration.get_provider().key,
            }

    def test_status_sync_inbound_unresolve(self):
        group = self.group
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.save()
        assert group.status == GroupStatus.RESOLVED

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", external_id="123456")
            integration.add_organization(group.organization, self.user)

            for oi in OrganizationIntegration.objects.filter(
                integration_id=integration.id, organization_id=group.organization.id
            ):
                oi.update(
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
        assert isinstance(installation, ExampleIntegration)

        with self.feature("organizations:integrations-issue-sync"), self.tasks():
            installation.sync_status_inbound(
                external_issue.key,
                {"project_id": "APP", "status": {"id": "12345", "category": "in_progress"}},
            )

            assert Group.objects.get(id=group.id).status == GroupStatus.UNRESOLVED
            activity = Activity.objects.get(
                group_id=group.id, type=ActivityType.SET_UNRESOLVED.value
            )
            assert activity.data == {
                "integration_id": integration.id,
                "provider": integration.get_provider().name,
                "provider_key": integration.get_provider().key,
            }


class IssueDefaultTest(TestCase):
    def setUp(self):
        self.group.status = GroupStatus.RESOLVED
        self.group.substatus = None
        self.group.save()

        integration = self.create_integration(
            organization=self.group.organization, provider="example", external_id="123456"
        )

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

        installation = integration.get_installation(organization_id=self.group.organization.id)
        assert isinstance(installation, ExampleIntegration)
        self.installation = installation

    def test_get_repository_choices(self):
        default_repo, repo_choice = self.installation.get_repository_choices(self.group, {})
        assert default_repo == "user/repo"
        assert repo_choice == [("user/repo", "repo")]

    def test_get_repository_choices_no_repos(self):
        with mock.patch.object(self.installation, "get_repositories", return_value=[]):
            default_repo, repo_choice = self.installation.get_repository_choices(self.group, {})
            assert default_repo == ""
            assert repo_choice == []

    def test_get_repository_choices_default_repo(self):
        assert self.installation.org_integration is not None
        self.installation.org_integration = integration_service.update_organization_integration(
            org_integration_id=self.installation.org_integration.id,
            config={"project_issue_defaults": {str(self.group.project_id): {"repo": "user/repo2"}}},
        )
        with mock.patch.object(
            self.installation,
            "get_repositories",
            return_value=[
                {"name": "repo1", "identifier": "user/repo1"},
                {"name": "repo2", "identifier": "user/repo2"},
            ],
        ):
            default_repo, repo_choice = self.installation.get_repository_choices(self.group, {})
            assert default_repo == "user/repo2"
            assert repo_choice == [("user/repo1", "repo1"), ("user/repo2", "repo2")]

    def test_store_issue_last_defaults_partial_update(self):
        assert "project" in self.installation.get_persisted_default_config_fields()
        assert "issueType" in self.installation.get_persisted_default_config_fields()
        assert "assignedTo" in self.installation.get_persisted_user_default_config_fields()
        assert "reportedBy" in self.installation.get_persisted_user_default_config_fields()

        self.installation.store_issue_last_defaults(
            self.project,
            self.user,
            {"project": "xyz", "issueType": "BUG", "assignedTo": "userA", "reportedBy": "userB"},
        )
        self.installation.store_issue_last_defaults(
            self.project, self.user, {"issueType": "FEATURE", "assignedTo": "userC"}
        )
        # {} is commonly triggered by "link issue" flow
        self.installation.store_issue_last_defaults(self.project, self.user, {})
        assert self.installation.get_defaults(self.project, self.user) == {
            "project": "xyz",
            "issueType": "FEATURE",
            "assignedTo": "userC",
            "reportedBy": "userB",
        }

    def test_store_issue_last_defaults_multiple_projects(self):
        assert "project" in self.installation.get_persisted_default_config_fields()
        other_project = self.create_project(name="Foo", slug="foo", teams=[self.team])
        self.installation.store_issue_last_defaults(
            self.project, self.user, {"project": "xyz", "reportedBy": "userA"}
        )
        self.installation.store_issue_last_defaults(
            other_project, self.user, {"project": "abc", "reportedBy": "userB"}
        )
        assert self.installation.get_defaults(self.project, self.user) == {
            "project": "xyz",
            "reportedBy": "userA",
        }
        assert self.installation.get_defaults(other_project, self.user) == {
            "project": "abc",
            "reportedBy": "userB",
        }

    def test_store_issue_last_defaults_for_user_multiple_providers(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            other_integration = self.create_provider_integration(
                provider=AliasedIntegrationProvider.key
            )
            other_integration.add_organization(self.organization, self.user)
        other_installation = other_integration.get_installation(self.organization.id)
        assert isinstance(other_installation, ExampleIntegration)

        self.installation.store_issue_last_defaults(
            self.project, self.user, {"project": "xyz", "reportedBy": "userA"}
        )
        other_installation.store_issue_last_defaults(
            self.project, self.user, {"project": "abc", "reportedBy": "userB"}
        )
        assert self.installation.get_defaults(self.project, self.user) == {
            "project": "xyz",
            "reportedBy": "userA",
        }
        assert other_installation.get_defaults(self.project, self.user) == {
            "project": "abc",
            "reportedBy": "userB",
        }

    def test_annotations(self):
        label = self.installation.get_issue_display_name(self.external_issue)
        link = self.installation.get_issue_url(self.external_issue.key)

        assert self.installation.get_annotations_for_group_list([self.group]) == {
            self.group.id: [{"url": link, "displayName": label}]
        }

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", external_id="4444")
            integration.add_organization(self.group.organization, self.user)
        installation = integration.get_installation(self.group.organization.id)
        assert isinstance(installation, ExampleIntegration)

        assert installation.get_annotations_for_group_list([self.group]) == {self.group.id: []}
