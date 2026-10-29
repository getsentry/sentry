from base64 import urlsafe_b64encode
from io import BytesIO

from django.urls import reverse

from sentry.models.distribution import Distribution
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.response import close_streaming_response
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class ReleaseFileDetailsTest(APITestCase):
    def test_simple(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(releasefile.id)

    def test_file_download(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        from io import BytesIO

        f = File.objects.create(name="applications.js", type="release.file")
        f.putfile(BytesIO(b"File contents here"))

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release_id=release.id,
            file=f,
            name="  http://example.com/appli\n\rcatios n.js\n\n\r  ",
        )

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.get(url + "?download=1")
        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="appli catios n.js"'
        assert response.get("Content-Length") == str(f.size)
        assert response.get("Content-Type") == "application/octet-stream"
        assert b"File contents here" == close_streaming_response(response)

        user_no_permission = self.create_user("baz@localhost", username="baz")
        self.login_as(user=user_no_permission)
        response = self.client.get(url + "?download=1")
        assert response.status_code == 403, response.content

    def _create_downloadable_file(self, project: Project, *additional_projects: Project) -> str:
        release = self.create_release(project, additional_projects=additional_projects)
        f = self.create_file(name="application.js", type="release.file")
        f.putfile(BytesIO(b"File contents here"))
        releasefile = self.create_release_file(
            release.id, file=f, name="http://example.com/application.js"
        )

        return reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

    def test_file_download_requires_debug_files_role(self) -> None:
        url = self._create_downloadable_file(self.create_project(name="foo"))

        member = self.create_user("member@example.com")
        self.create_member(user=member, organization=self.organization, role="member")
        admin = self.create_user("org-admin@example.com")
        self.create_member(user=admin, organization=self.organization, role="admin")

        # The default debug files role is admin
        self.login_as(user=member)
        response = self.client.get(url + "?download=1")
        assert response.status_code == 403, response.content

        self.login_as(user=admin)
        response = self.client.get(url + "?download=1")
        assert response.status_code == 200, response.content
        assert b"File contents here" == close_streaming_response(response)

        self.organization.update_option("sentry:debug_files_role", "owner")
        response = self.client.get(url + "?download=1")
        assert response.status_code == 403, response.content

        self.organization.update_option("sentry:debug_files_role", "member")
        self.login_as(user=member)
        response = self.client.get(url + "?download=1")
        assert response.status_code == 200, response.content
        assert b"File contents here" == close_streaming_response(response)

    def test_file_download_org_auth_token(self) -> None:
        url = self._create_downloadable_file(self.create_project(name="foo"))

        member = self.create_user("member@example.com")
        self.create_member(user=member, organization=self.organization, role="member")
        token = generate_token(self.organization.slug, "")
        self.create_org_auth_token(
            name="CI token",
            token_hashed=hash_token(token),
            organization_id=self.organization.id,
            scope_list=["org:ci"],
            created_by_id=member.id,
            date_last_used=None,
        )
        auth_header = f"Bearer {token}"

        response = self.client.get(url, HTTP_AUTHORIZATION=auth_header)
        assert response.status_code == 200, response.content

        # Userless tokens can never download, whatever the debug files role
        response = self.client.get(url + "?download=1", HTTP_AUTHORIZATION=auth_header)
        assert response.status_code == 403, response.content

        self.organization.update_option("sentry:debug_files_role", "member")
        response = self.client.get(url + "?download=1", HTTP_AUTHORIZATION=auth_header)
        assert response.status_code == 403, response.content

    def test_file_download_only_considers_accessible_projects(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)
        project1 = self.create_project(teams=[team1])
        project2 = self.create_project(teams=[team2])
        url = self._create_downloadable_file(project1, project2)

        member = self.create_user("member@example.com")
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[team1]
        )
        self.login_as(user=member)

        # A lower role on a project the member cannot access does not apply
        project2.update_option("sentry:debug_files_role", "member")
        response = self.client.get(url + "?download=1")
        assert response.status_code == 403, response.content

        project1.update_option("sentry:debug_files_role", "member")
        response = self.client.get(url + "?download=1")
        assert response.status_code == 200, response.content
        assert b"File contents here" == close_streaming_response(response)

    def _get(self, file_id):
        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "version": self.release.version,
                "file_id": file_id,
            },
        )

        return self.client.get(url)

    def test_invalid_id(self) -> None:
        self.login_as(user=self.user)
        response = self._get("foo666")
        assert response.status_code == 404, response.content

    def test_archived(self) -> None:
        self.login_as(user=self.user)
        self.create_release_archive()
        id = urlsafe_b64encode(b"_~/index.js")
        response = self._get(id.decode())
        assert response.status_code == 200
        assert response.data["id"] == id

    def test_archived_with_dist(self) -> None:
        self.login_as(user=self.user)
        dist = Distribution.objects.create(
            organization_id=self.organization.id, release_id=self.release.id, name="foo"
        )
        self.create_release_archive(dist=dist)
        id = urlsafe_b64encode(b"foo_~/index.js")
        response = self._get(id.decode())
        assert response.status_code == 200
        assert response.data["id"] == id


class ReleaseFileUpdateTest(APITestCase):
    def test_no_access_to_all_projects(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        release = Release.objects.create(organization_id=org.id, version="1")
        release.add_project(project1)
        release.add_project(project2)

        releasefile = ReleaseFile.objects.create(
            organization_id=org.id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": org.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )
        response = self.client.put(url, {"name": "foobar"})

        assert response.status_code == 404

    def test_no_access_to_all_projects_open_membership(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = True
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        release = Release.objects.create(organization_id=org.id, version="1")
        release.add_project(project1)
        release.add_project(project2)

        releasefile = ReleaseFile.objects.create(
            organization_id=org.id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": org.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )
        response = self.client.put(url, {"name": "foobar"})

        assert response.status_code == 200

    def test_simple(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.put(url, {"name": "foobar"})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(releasefile.id)

        releasefile = ReleaseFile.objects.get(id=releasefile.id)
        assert releasefile.name == "foobar"
        assert releasefile.ident == ReleaseFile.get_ident("foobar")


class ReleaseFileDeleteTest(APITestCase):
    def test_no_access_to_all_projects(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        release = Release.objects.create(organization_id=org.id, version="1")
        release.add_project(project1)
        release.add_project(project2)

        releasefile = ReleaseFile.objects.create(
            organization_id=org.id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": org.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )
        response = self.client.delete(url)

        assert response.status_code == 404
        assert ReleaseFile.objects.filter(id=releasefile.id).exists()

    def test_simple(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        assert release.count_artifacts() == 0

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        assert release.count_artifacts() == 1

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not ReleaseFile.objects.filter(id=releasefile.id).exists()
        assert not File.objects.filter(id=releasefile.file.id).exists()
        assert release.count_artifacts() == 0
