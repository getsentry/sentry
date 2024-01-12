from django.urls import reverse

from sentry.models.artifactbundle import ProjectArtifactBundle, ReleaseArtifactBundle
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.files.file import File
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releasefile import ReleaseFile
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class ReleaseMetaTest(APITestCase):
    def test_multiple_projects(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)
        release.add_project(project2)

        ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="a" * 40
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="b" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit2, order=0
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore", type="M"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id,
            commit=commit2,
            filename="/static/js/widget.js",
            type="A",
        )

        release.commit_count = 2
        release.total_deploys = 1
        release.new_groups = 42
        release.save()

        self.create_member(teams=[team1, team2], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-meta",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content

        data = json.loads(response.content)
        assert data["deployCount"] == 1
        assert data["commitCount"] == 2
        assert data["newGroups"] == 42
        assert data["commitFilesChanged"] == 2
        assert data["releaseFileCount"] == 1
        assert len(data["projects"]) == 2

    def test_artifact_count_without_weak_association(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        project = self.create_project(teams=[team1], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)

        self.create_release_archive(release=release.version)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-meta",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content

        data = json.loads(response.content)
        assert data["releaseFileCount"] == 2
        assert not data["isArtifactBundle"]

    def test_artifact_count_with_single_weak_association(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        project = self.create_project(teams=[team1], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)

        self.create_release_archive(release=release.version)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        bundle = self.create_artifact_bundle(org=org, artifact_count=10)
        ProjectArtifactBundle.objects.create(
            organization_id=org.id, project_id=project.id, artifact_bundle=bundle
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=org.id, release_name=release.version, artifact_bundle=bundle
        )

        url = reverse(
            "sentry-api-0-organization-release-meta",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content

        data = json.loads(response.content)
        assert data["releaseFileCount"] == 10
        assert data["isArtifactBundle"]

    def test_artifact_count_with_multiple_weak_association(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        project = self.create_project(teams=[team1], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)

        self.create_release_archive(release=release.version)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        bundle_1 = self.create_artifact_bundle(org=org, artifact_count=10)
        ProjectArtifactBundle.objects.create(
            organization_id=org.id, project_id=project.id, artifact_bundle=bundle_1
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=org.id, release_name=release.version, artifact_bundle=bundle_1
        )
        bundle_2 = self.create_artifact_bundle(org=org, artifact_count=30)
        ProjectArtifactBundle.objects.create(
            organization_id=org.id, project_id=project.id, artifact_bundle=bundle_2
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=org.id, release_name=release.version, artifact_bundle=bundle_2
        )
        # We create a bundle associated with the same release but not connected to the project to make sure it is not
        # counted.
        bundle_3 = self.create_artifact_bundle(org=org, artifact_count=50)
        ReleaseArtifactBundle.objects.create(
            organization_id=org.id, release_name=release.version, artifact_bundle=bundle_3
        )

        url = reverse(
            "sentry-api-0-organization-release-meta",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content

        data = json.loads(response.content)
        assert data["releaseFileCount"] == 40
        assert data["isArtifactBundle"]
