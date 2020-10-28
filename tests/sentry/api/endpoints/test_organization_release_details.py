from __future__ import absolute_import
import unittest
from sentry.utils.compat.mock import patch
from datetime import datetime

import pytz
from django.core.urlresolvers import reverse

from sentry.constants import MAX_VERSION_LENGTH
from sentry.models import (
    Activity,
    Environment,
    File,
    Release,
    ReleaseCommit,
    ReleaseFile,
    ReleaseProject,
    ReleaseProjectEnvironment,
    Repository,
)
from sentry.testutils import APITestCase
from sentry.api.endpoints.organization_release_details import OrganizationReleaseSerializer


class ReleaseDetailsTest(APITestCase):
    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release2 = Release.objects.create(organization_id=org.id, version="12345678")
        release.add_project(project)
        release2.add_project(project2)

        environment = Environment.objects.create(organization_id=org.id, name="prod")
        environment.add_project(project)
        environment.add_project(project2)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        ReleaseProjectEnvironment.objects.create(
            project_id=project.id,
            release_id=release.id,
            environment_id=environment.id,
            new_issues_count=5,
        )
        ReleaseProject.objects.filter(project=project, release=release).update(new_groups=5)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version
        assert response.data["newGroups"] == 5

        # no access
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release2.version},
        )
        response = self.client.get(url)
        assert response.status_code == 404

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

        self.create_member(teams=[team1, team2], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content

    def test_wrong_project(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)

        project = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team1], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )

        response = self.client.get(url, {"project": project2.id})
        assert response.status_code == 404

        response = self.client.get(url, {"project": project.id})
        assert response.status_code == 200


class UpdateReleaseDetailsTest(APITestCase):
    @patch("sentry.tasks.commits.fetch_commits")
    def test_simple(self, mock_fetch_commits):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        repo = Repository.objects.create(
            organization_id=org.id, name="example/example", provider="dummy"
        )
        repo2 = Repository.objects.create(
            organization_id=org.id, name="example/example2", provider="dummy"
        )

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        base_release = Release.objects.create(organization_id=org.id, version="000000000")
        base_release.add_project(project)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release2 = Release.objects.create(organization_id=org.id, version="12345678")
        release.add_project(project)
        release2.add_project(project2)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": base_release.version},
        )
        self.client.put(
            url,
            {
                "ref": "master",
                "headCommits": [
                    {"currentId": "0" * 40, "repository": repo.name},
                    {"currentId": "0" * 40, "repository": repo2.name},
                ],
            },
        )

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            {
                "ref": "master",
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name},
                    {"commit": "b" * 40, "repository": repo2.name},
                ],
            },
        )

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                "release_id": release.id,
                "user_id": user.id,
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name},
                    {"commit": "b" * 40, "repository": repo2.name},
                ],
                "prev_release_id": base_release.id,
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == "master"

        # no access
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release2.version},
        )
        response = self.client.put(url, {"ref": "master"})
        assert response.status_code == 404

    @patch("sentry.tasks.commits.fetch_commits")
    def test_deprecated_head_commits(self, mock_fetch_commits):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        repo = Repository.objects.create(
            organization_id=org.id, name="example/example", provider="dummy"
        )
        repo2 = Repository.objects.create(
            organization_id=org.id, name="example/example2", provider="dummy"
        )

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        base_release = Release.objects.create(organization_id=org.id, version="000000000")
        base_release.add_project(project)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release2 = Release.objects.create(organization_id=org.id, version="12345678")
        release.add_project(project)
        release2.add_project(project2)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": base_release.version},
        )
        self.client.put(
            url,
            {
                "ref": "master",
                "headCommits": [
                    {"currentId": "0" * 40, "repository": repo.name},
                    {"currentId": "0" * 40, "repository": repo2.name},
                ],
            },
        )

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            {
                "ref": "master",
                "headCommits": [
                    {"currentId": "a" * 40, "repository": repo.name},
                    {"currentId": "b" * 40, "repository": repo2.name},
                ],
            },
        )

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                "release_id": release.id,
                "user_id": user.id,
                "refs": [
                    {"commit": "a" * 40, "previousCommit": None, "repository": repo.name},
                    {"commit": "b" * 40, "previousCommit": None, "repository": repo2.name},
                ],
                "prev_release_id": base_release.id,
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == "master"

        # no access
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release2.version},
        )
        response = self.client.put(url, {"ref": "master"})
        assert response.status_code == 404

    def test_commits(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(url, data={"commits": [{"id": "a" * 40}, {"id": "b" * 40}]})

        assert response.status_code == 200, (response.status_code, response.content)

        rc_list = list(
            ReleaseCommit.objects.filter(release=release)
            .select_related("commit", "commit__author")
            .order_by("order")
        )
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id == org.id

    def test_activity_generation(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(url, data={"dateReleased": datetime.utcnow().isoformat() + "Z"})

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=Activity.RELEASE, project=project, ident=release.version
        )
        assert activity.exists()

    def test_activity_generation_long_release(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="x" * 65)

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(url, data={"dateReleased": datetime.utcnow().isoformat() + "Z"})

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=Activity.RELEASE, project=project, ident=release.version[:64]
        )
        assert activity.exists()


class ReleaseDeleteTest(APITestCase):
    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)
        release_file = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not Release.objects.filter(id=release.id).exists()
        assert not ReleaseFile.objects.filter(id=release_file.id).exists()

    def test_existing_group(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)
        self.create_group(first_release=release)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.delete(url)

        assert response.status_code == 400, response.content

        assert Release.objects.filter(id=release.id).exists()

    def test_bad_repo_name(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            data={
                "version": "1.2.1",
                "projects": [project.slug],
                "refs": [{"repository": "not_a_repo", "commit": "a" * 40}],
            },
        )
        assert response.status_code == 400
        assert response.data == {"refs": [u"Invalid repository names: not_a_repo"]}

    def test_bad_commit_list(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        Repository.objects.create(organization_id=org.id, name="a_repo")
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            data={
                "version": "1.2.1",
                "projects": [project.slug],
                "commits": [{"repository": "a_repo"}],
            },
        )
        assert response.status_code == 400
        assert response.data == {"commits": {"id": ["This field is required."]}}


class ReleaseSerializerTest(unittest.TestCase):
    def setUp(self):
        super(ReleaseSerializerTest, self).setUp()
        self.repo_name = "repo/name"
        self.repo2_name = "repo2/name"
        self.commits = [{"id": "a" * 40}, {"id": "b" * 40}]
        self.ref = "master"
        self.url = "https://example.com"
        self.dateReleased = "1000-10-10T06:06"
        self.headCommits = [
            {"currentId": "0" * 40, "repository": self.repo_name},
            {"currentId": "0" * 40, "repository": self.repo2_name},
        ]
        self.refs = [
            {"commit": "a" * 40, "previousCommit": "", "repository": self.repo_name},
            {"commit": "b" * 40, "previousCommit": "", "repository": self.repo2_name},
        ]

    def test_simple(self):
        serializer = OrganizationReleaseSerializer(
            data={
                "ref": self.ref,
                "url": self.url,
                "dateReleased": self.dateReleased,
                "commits": self.commits,
                "headCommits": self.headCommits,
                "refs": self.refs,
            }
        )

        assert serializer.is_valid()
        assert sorted(serializer.fields.keys()) == sorted(
            ["ref", "url", "dateReleased", "commits", "headCommits", "refs"]
        )

        result = serializer.validated_data
        assert result["ref"] == self.ref
        assert result["url"] == self.url
        assert result["dateReleased"] == datetime(1000, 10, 10, 6, 6, tzinfo=pytz.UTC)
        assert result["commits"] == self.commits
        assert result["headCommits"] == self.headCommits
        assert result["refs"] == self.refs

    def test_fields_not_required(self):
        serializer = OrganizationReleaseSerializer(data={})
        assert serializer.is_valid()

    def test_do_not_allow_null_commits(self):
        serializer = OrganizationReleaseSerializer(data={"commits": None})
        assert not serializer.is_valid()

    def test_do_not_allow_null_head_commits(self):
        serializer = OrganizationReleaseSerializer(data={"headCommits": None})
        assert not serializer.is_valid()

    def test_do_not_allow_null_refs(self):
        serializer = OrganizationReleaseSerializer(data={"refs": None})
        assert not serializer.is_valid()

    def test_ref_limited_by_max_version_length(self):
        serializer = OrganizationReleaseSerializer(data={"ref": "a" * MAX_VERSION_LENGTH})
        assert serializer.is_valid()
        serializer = OrganizationReleaseSerializer(data={"ref": "a" * (MAX_VERSION_LENGTH + 1)})
        assert not serializer.is_valid()
