from __future__ import annotations

from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.releases.use_cases.release import serialize as release_serializer
from sentry.testutils.cases import TestCase


class ReleaseSerializerUseCaseTest(TestCase):
    """
    Tests for the releases.use_cases.release.serialize function.

    This tests the NEW serializer that fixes the per-project newGroups calculation,
    as opposed to the old model-based serializer in api.serializers.models.release.
    """

    def test_new_groups_single_release_per_project(self):
        """
        Test new groups counts for one release with multiple projects, each having different issue counts.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        # Create release in projects A and B
        release_version = "1.0.0"
        release = Release.objects.create(
            organization_id=project_a.organization_id, version=release_version
        )
        release.add_project(project_a)
        release.add_project(project_b)

        # 3 new groups for project A, 2 new groups for project B
        ReleaseProject.objects.filter(release=release, project=project_a).update(new_groups=3)
        ReleaseProject.objects.filter(release=release, project=project_b).update(new_groups=2)

        result = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],  # No environment filtering
            projects=[project_a, project_b],
        )

        assert len(result) == 1
        serialized_release = result[0]

        # total new groups count (5 == 3 + 2)
        assert serialized_release["newGroups"] == 5

        # new groups count for each project (3 for A, 2 for B)
        projects = {p["id"]: p for p in serialized_release["projects"]}
        assert projects[project_a.id]["newGroups"] == 3
        assert projects[project_b.id]["newGroups"] == 2

        assert projects[project_a.id]["name"] == "Project A"
        assert projects[project_a.id]["slug"] == "project-a"
        assert projects[project_b.id]["name"] == "Project B"
        assert projects[project_b.id]["slug"] == "project-b"

    def test_new_groups_multiple_releases_per_project(self):
        """
        Test new groups count for multiple releases per project.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        # Create releases 1 and 2, both in projects A and B
        release_1 = Release.objects.create(
            organization_id=project_a.organization_id, version="1.0.0"
        )
        release_1.add_project(project_a)
        release_1.add_project(project_b)
        release_2 = Release.objects.create(
            organization_id=project_a.organization_id, version="2.0.0"
        )
        release_2.add_project(project_a)
        release_2.add_project(project_b)

        # Release 1.0.0 has 3 new groups for project A, 2 new groups for project B
        ReleaseProject.objects.filter(release=release_1, project=project_a).update(new_groups=3)
        ReleaseProject.objects.filter(release=release_1, project=project_b).update(new_groups=2)

        # Release 2.0.0 has 1 new groups for project A, 4 new groups for project B
        ReleaseProject.objects.filter(release=release_2, project=project_a).update(new_groups=1)
        ReleaseProject.objects.filter(release=release_2, project=project_b).update(new_groups=4)

        # 1. Serialize Release 1.0.0
        result = release_serializer(
            releases=[release_1],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        assert serialized_release["version"] == "1.0.0"
        assert serialized_release["newGroups"] == 5  # total new groups count (5 == 3 + 2)
        projects = {p["id"]: p for p in serialized_release["projects"]}
        # new groups count for each project (3 for A, 2 for B)
        assert projects[project_a.id]["newGroups"] == 3
        assert projects[project_b.id]["newGroups"] == 2

        # 2. Serialize Release 2.0.0
        result = release_serializer(
            releases=[release_2],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        assert serialized_release["version"] == "2.0.0"
        assert serialized_release["newGroups"] == 5  # total new groups count (5 == 1 + 4)
        projects = {p["id"]: p for p in serialized_release["projects"]}
        # new groups count for each project (1 for A, 4 for B)
        assert projects[project_a.id]["newGroups"] == 1
        assert projects[project_b.id]["newGroups"] == 4

        # 3. Serialize both releases together
        result = release_serializer(
            releases=[release_1, release_2],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )
        assert len(result) == 2
        serialized_releases = {r["version"]: r for r in result}
        serialized_release_1 = serialized_releases["1.0.0"]
        serialized_release_2 = serialized_releases["2.0.0"]
        # both new group counts should be 5
        assert serialized_release_1["newGroups"] == 5
        assert serialized_release_2["newGroups"] == 5
        # new groups counts for each project
        projects_1 = {p["id"]: p for p in serialized_release_1["projects"]}
        projects_2 = {p["id"]: p for p in serialized_release_2["projects"]}
        assert projects_1[project_a.id]["newGroups"] == 3
        assert projects_1[project_b.id]["newGroups"] == 2
        assert projects_2[project_a.id]["newGroups"] == 1
        assert projects_2[project_b.id]["newGroups"] == 4

    def test_new_groups_environment_filtering(self):
        """
        Test new group counts for a single release with environment filtering.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        production = self.create_environment(name="production", organization=project_a.organization)
        staging = self.create_environment(name="staging", organization=project_a.organization)

        release = Release.objects.create(organization_id=project_a.organization_id, version="1.0.0")
        release.add_project(project_a)
        release.add_project(project_b)

        # 4 new groups for project A, 2 new groups for project B
        ReleaseProject.objects.filter(release=release, project=project_a).update(new_groups=4)
        ReleaseProject.objects.filter(release=release, project=project_b).update(new_groups=2)

        # Project A: 3 issues in production, 1 issue in staging (total = 4)
        ReleaseProjectEnvironment.objects.create(
            release=release, project=project_a, environment=production, new_issues_count=3
        )
        ReleaseProjectEnvironment.objects.create(
            release=release, project=project_a, environment=staging, new_issues_count=1
        )

        # Project B: 2 issues in production, 0 issues in staging (total = 2)
        ReleaseProjectEnvironment.objects.create(
            release=release, project=project_b, environment=production, new_issues_count=2
        )
        ReleaseProjectEnvironment.objects.create(
            release=release, project=project_b, environment=staging, new_issues_count=0
        )

        # 1. No environment filter
        result = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        projects = {p["id"]: p for p in serialized_release["projects"]}
        assert projects[project_a.id]["newGroups"] == 4
        assert projects[project_b.id]["newGroups"] == 2
        assert serialized_release["newGroups"] == 6

        # 2. Filter by production environment
        result = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[production.id],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        projects = {p["id"]: p for p in serialized_release["projects"]}
        assert projects[project_a.id]["newGroups"] == 3
        assert projects[project_b.id]["newGroups"] == 2
        assert serialized_release["newGroups"] == 5

        # 3. Filter by staging environment
        result = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[staging.id],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        projects = {p["id"]: p for p in serialized_release["projects"]}
        assert projects[project_a.id]["newGroups"] == 1
        assert projects[project_b.id]["newGroups"] == 0
        assert serialized_release["newGroups"] == 1

        # 4. Filter by both environments
        result = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[production.id, staging.id],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        projects = {p["id"]: p for p in serialized_release["projects"]}
        assert projects[project_a.id]["newGroups"] == 4
        assert projects[project_b.id]["newGroups"] == 2
        assert serialized_release["newGroups"] == 6

    def test_new_groups_cross_project_release_environment(self):
        """
        Test new group counts for multiple releases with different environments.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        production = self.create_environment(name="production", organization=project_a.organization)
        staging = self.create_environment(name="staging", organization=project_a.organization)

        release_1 = Release.objects.create(
            organization_id=project_a.organization_id, version="1.0.0"
        )
        release_1.add_project(project_a)
        release_1.add_project(project_b)

        release_2 = Release.objects.create(
            organization_id=project_a.organization_id, version="2.0.0"
        )
        release_2.add_project(project_a)
        release_2.add_project(project_b)

        # Release 1.0.0: Project A = 4 (3+1), Project B = 2 (2+0)
        ReleaseProject.objects.filter(release=release_1, project=project_a).update(new_groups=4)
        ReleaseProject.objects.filter(release=release_1, project=project_b).update(new_groups=2)
        # Release 2.0.0: Project A = 3 (1+2), Project B = 5 (4+1)
        ReleaseProject.objects.filter(release=release_2, project=project_a).update(new_groups=3)
        ReleaseProject.objects.filter(release=release_2, project=project_b).update(new_groups=5)

        # Release 1.0.0 - Project A: 3 in production, 1 in staging
        ReleaseProjectEnvironment.objects.create(
            release=release_1, project=project_a, environment=production, new_issues_count=3
        )
        ReleaseProjectEnvironment.objects.create(
            release=release_1, project=project_a, environment=staging, new_issues_count=1
        )
        # Release 1.0.0 - Project B: 2 in production, 0 in staging (no staging record)
        ReleaseProjectEnvironment.objects.create(
            release=release_1, project=project_b, environment=production, new_issues_count=2
        )
        # Release 2.0.0 - Project A: 1 in production, 2 in staging
        ReleaseProjectEnvironment.objects.create(
            release=release_2, project=project_a, environment=production, new_issues_count=1
        )
        ReleaseProjectEnvironment.objects.create(
            release=release_2, project=project_a, environment=staging, new_issues_count=2
        )
        # Release 2.0.0 - Project B: 4 in production, 1 in staging
        ReleaseProjectEnvironment.objects.create(
            release=release_2, project=project_b, environment=production, new_issues_count=4
        )
        ReleaseProjectEnvironment.objects.create(
            release=release_2, project=project_b, environment=staging, new_issues_count=1
        )

        # 1. Serialize Release 1.0.0 with production filter
        result = release_serializer(
            releases=[release_1],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[production.id],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        assert serialized_release["version"] == "1.0.0"
        assert serialized_release["newGroups"] == 5
        projects = {p["id"]: p for p in serialized_release["projects"]}
        assert projects[project_a.id]["newGroups"] == 3
        assert projects[project_b.id]["newGroups"] == 2

        # 2. Serialize Release 2.0.0 with production filter
        result = release_serializer(
            releases=[release_2],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[production.id],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        assert serialized_release["version"] == "2.0.0"
        assert serialized_release["newGroups"] == 5
        projects = {p["id"]: p for p in serialized_release["projects"]}
        assert projects[project_a.id]["newGroups"] == 1
        assert projects[project_b.id]["newGroups"] == 4

        # 3. Serialize both releases together with production filter
        result = release_serializer(
            releases=[release_1, release_2],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[production.id],
            projects=[project_a, project_b],
        )
        assert len(result) == 2
        serialized_releases = {r["version"]: r for r in result}
        serialized_release_1 = serialized_releases["1.0.0"]
        serialized_release_2 = serialized_releases["2.0.0"]
        assert serialized_release_1["newGroups"] == 5
        assert serialized_release_2["newGroups"] == 5
        projects_1 = {p["id"]: p for p in serialized_release_1["projects"]}
        projects_2 = {p["id"]: p for p in serialized_release_2["projects"]}
        assert projects_1[project_a.id]["newGroups"] == 3
        assert projects_1[project_b.id]["newGroups"] == 2
        assert projects_2[project_a.id]["newGroups"] == 1
        assert projects_2[project_b.id]["newGroups"] == 4

        # 5. Serialize Release 1.0.0 with no environment filter
        result = release_serializer(
            releases=[release_1],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )
        assert len(result) == 1
        serialized_release = result[0]
        assert serialized_release["newGroups"] == 6
        projects = {p["id"]: p for p in serialized_release["projects"]}
        assert projects[project_a.id]["newGroups"] == 4
        assert projects[project_b.id]["newGroups"] == 2
