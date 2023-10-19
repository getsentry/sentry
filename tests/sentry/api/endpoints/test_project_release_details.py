import unittest
from datetime import datetime, timezone

from django.urls import reverse

from sentry.api.serializers.rest_framework.release import ReleaseSerializer
from sentry.constants import MAX_VERSION_LENGTH
from sentry.models.activity import Activity
from sentry.models.files.file import File
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.release import Release, ReleaseProject
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releasefile import ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token

pytestmark = [requires_snuba]


class ReleaseDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        project2 = self.create_project(name="bar", organization=project.organization)

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        release.add_project(project2)

        ReleaseProject.objects.filter(project=project, release=release).update(new_groups=5)

        url = reverse(
            "sentry-api-0-project-release-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version
        assert response.data["newGroups"] == 5


class UpdateReleaseDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        project2 = self.create_project(name="bar", organization=project.organization)

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            "sentry-api-0-project-release-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )
        response = self.client.put(url, {"ref": "master"})

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == "master"

    def test_commits(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        project2 = self.create_project(name="bar", organization=project.organization)

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            "sentry-api-0-project-release-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
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
            assert rc.organization_id

    def test_activity_generation(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        project2 = self.create_project(name="bar", organization=project.organization)

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            "sentry-api-0-project-release-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )
        response = self.client.put(url, data={"dateReleased": datetime.utcnow().isoformat() + "Z"})

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=ActivityType.RELEASE.value, project=project, ident=release.version
        )
        assert activity.exists()

    def test_activity_generation_long_version(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        project2 = self.create_project(name="bar", organization=project.organization)

        release = Release.objects.create(organization_id=project.organization_id, version="x" * 65)
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            "sentry-api-0-project-release-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )
        response = self.client.put(url, data={"dateReleased": datetime.utcnow().isoformat() + "Z"})

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=ActivityType.RELEASE.value, project=project, ident=release.version[:64]
        )
        assert activity.exists()

    def test_org_auth_token(self):
        project = self.create_project(name="foo")
        project2 = self.create_project(name="bar", organization=project.organization)

        good_token_str = generate_token(project.organization.slug, "")
        OrgAuthToken.objects.create(
            organization_id=project.organization.id,
            name="token 1",
            token_hashed=hash_token(good_token_str),
            token_last_characters="ABCD",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            "sentry-api-0-project-release-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )
        response = self.client.put(
            url,
            data={"ref": "master"},
            HTTP_AUTHORIZATION=f"Bearer {good_token_str}",
        )

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == "master"


class ReleaseDeleteTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        project2 = self.create_project(name="bar", organization=project.organization)
        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        release.add_project(project2)
        ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        url = reverse(
            "sentry-api-0-project-release-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )
        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not Release.objects.filter(id=release.id).exists()

    def test_existing_group(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        project2 = self.create_project(name="baz", organization=project.organization)
        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        release.add_project(project2)
        self.create_group(first_release=release)

        url = reverse(
            "sentry-api-0-project-release-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )
        response = self.client.delete(url)

        assert response.status_code == 400, response.content

        assert Release.objects.filter(id=release.id).exists()


class ReleaseSerializerTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.commits = [{"id": "a" * 40}, {"id": "b" * 40}]
        self.ref = "master"
        self.url = "https://example.com"
        self.dateReleased = "1000-10-10T06:06"

    def test_simple(self):
        serializer = ReleaseSerializer(
            data={
                "ref": self.ref,
                "url": self.url,
                "dateReleased": self.dateReleased,
                "commits": self.commits,
            }
        )

        assert serializer.is_valid()
        assert set(serializer.fields.keys()) == {"ref", "url", "dateReleased", "commits", "status"}

        result = serializer.validated_data
        assert result["ref"] == self.ref
        assert result["url"] == self.url
        assert result["dateReleased"] == datetime(1000, 10, 10, 6, 6, tzinfo=timezone.utc)
        assert result["commits"] == self.commits

    def test_fields_not_required(self):
        serializer = ReleaseSerializer(data={})
        assert serializer.is_valid()

    def test_do_not_allow_null_commits(self):
        serializer = ReleaseSerializer(data={"commits": None})
        assert not serializer.is_valid()

    def test_ref_limited_by_max_version_length(self):
        serializer = ReleaseSerializer(data={"ref": "a" * MAX_VERSION_LENGTH})
        assert serializer.is_valid()
        serializer = ReleaseSerializer(data={"ref": "a" * (MAX_VERSION_LENGTH + 1)})
        assert not serializer.is_valid()
