from datetime import datetime, timedelta, timezone
from functools import cached_property

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.api.serializers.rest_framework.release import ReleaseWithVersionSerializer
from sentry.constants import BAD_RELEASE_CHARS, MAX_VERSION_LENGTH
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.environment import Environment
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.release import Release, ReleaseProject
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.repository import Repository
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase, ReleaseCommitPatchTest, TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token

pytestmark = [requires_snuba]


@region_silo_test
class ProjectReleaseListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        project2 = self.create_project(teams=[team], name="bar")

        release1 = Release.objects.create(
            organization_id=project1.organization_id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release1.add_project(project1)

        ReleaseProject.objects.filter(project=project1, release=release1).update(new_groups=5)

        release2 = Release.objects.create(
            organization_id=project1.organization_id,
            version="2",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        release2.add_project(project1)

        release3 = Release.objects.create(
            organization_id=project1.organization_id,
            version="3",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
            user_agent="my_agent",
        )
        release3.add_project(project1)

        release4 = Release.objects.create(organization_id=project2.organization_id, version="4")
        release4.add_project(project2)

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0]["version"] == release3.version
        assert response.data[0]["userAgent"] == "my_agent"
        assert response.data[1]["version"] == release2.version
        assert response.data[2]["version"] == release1.version
        assert response.data[2]["newGroups"] == 5

    def test_query_filter(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(teams=[team], name="foo")

        release = Release.objects.create(
            organization_id=project.organization_id,
            version="foobar",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release.add_project(project)

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.get(url + "?query=foo", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["version"] == release.version

        response = self.client.get(url + "?query=baz", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        release = Release.objects.create(
            organization_id=project.organization_id,
            version="foo.bar-1.0.0",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        release.add_project(project)

        response = self.client.get(url + "?query=1", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1


@region_silo_test
class ProjectReleaseListEnvironmentsTest(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)

        self.datetime = datetime(2013, 8, 13, 3, 8, 24, tzinfo=timezone.utc)
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        project2 = self.create_project(teams=[team], name="bar")

        env1 = self.make_environment("prod", project1)
        env2 = self.make_environment("staging", project2)
        env3 = self.make_environment("test", project1)

        release1 = Release.objects.create(
            organization_id=project1.organization_id, version="1", date_added=self.datetime
        )
        release1.add_project(project1)
        ReleaseProjectEnvironment.objects.create(
            release_id=release1.id,
            project_id=project1.id,
            environment_id=env1.id,
            first_seen=self.datetime,
            last_seen=self.datetime,
            new_issues_count=1,
        )
        release2 = Release.objects.create(
            organization_id=project2.organization_id, version="2", date_added=self.datetime
        )
        release2.add_project(project2)
        ReleaseProjectEnvironment.objects.create(
            release_id=release2.id,
            project_id=project2.id,
            environment_id=env2.id,
            first_seen=self.datetime,
            last_seen=self.datetime + timedelta(seconds=60),
            new_issues_count=6,
        )
        release3 = Release.objects.create(
            organization_id=project1.organization_id,
            version="3",
            date_added=self.datetime,
            date_released=self.datetime,
        )
        release3.add_project(project1)
        ReleaseProjectEnvironment.objects.create(
            release_id=release3.id,
            project_id=project1.id,
            environment_id=env3.id,
            first_seen=self.datetime,
            last_seen=self.datetime + timedelta(days=20),
            new_issues_count=2,
        )
        release4 = Release.objects.create(organization_id=project2.organization_id, version="4")
        release4.add_project(project2)

        self.project1 = project1
        self.project2 = project2

        self.release1 = release1
        self.release2 = release2
        self.release3 = release3
        self.release4 = release4

        self.env1 = env1
        self.env2 = env2
        self.env3 = env3

    def make_environment(self, name, project):
        env = Environment.objects.create(organization_id=project.organization_id, name=name)
        env.add_project(project)
        return env

    def assert_releases(self, response, releases):
        assert response.status_code == 200, response.content
        assert len(response.data) == len(releases)

        response_versions = sorted(r["version"] for r in response.data)
        releases_versions = sorted(r.version for r in releases)
        assert response_versions == releases_versions

    def assert_release_details(self, release, new_issues_count, first_seen, last_seen):
        assert release["newGroups"] == new_issues_count
        assert release["firstEvent"] == first_seen
        assert release["lastEvent"] == last_seen

    def test_environments_filter(self):
        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={
                "organization_slug": self.project1.organization.slug,
                "project_slug": self.project1.slug,
            },
        )
        response = self.client.get(url + "?environment=" + self.env1.name, format="json")
        self.assert_releases(response, [self.release1])

        response = self.client.get(url + "?environment=" + self.env2.name, format="json")
        self.assert_releases(response, [])

        response = self.client.get(url + "?environment=" + self.env3.name, format="json")
        self.assert_releases(response, [self.release3])
        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={
                "organization_slug": self.project2.organization.slug,
                "project_slug": self.project2.slug,
            },
        )
        response = self.client.get(url + "?environment=" + self.env2.name, format="json")
        self.assert_releases(response, [self.release2])

    def test_all_environments(self):
        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={
                "organization_slug": self.project1.organization.slug,
                "project_slug": self.project1.slug,
            },
        )
        response = self.client.get(url, format="json")
        self.assert_releases(response, [self.release1, self.release3])

    def test_invalid_environment(self):
        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={
                "organization_slug": self.project1.organization.slug,
                "project_slug": self.project1.slug,
            },
        )
        response = self.client.get(url + "?environment=" + "invalid_environment", format="json")
        self.assert_releases(response, [])

    def test_new_issues_last_seen_first_seen(self):
        def sort_releases_by_version(releases):
            return sorted(releases, key=lambda release: release["version"])

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={
                "organization_slug": self.project1.organization.slug,
                "project_slug": self.project1.slug,
            },
        )
        ReleaseProjectEnvironment.objects.create(
            release_id=self.release1.id,
            project_id=self.project1.id,
            environment_id=self.env3.id,
            first_seen=self.datetime + timedelta(seconds=120),
            last_seen=self.datetime + timedelta(seconds=700),
            new_issues_count=7,
        )

        # TODO(LB): This is testing all environments but it will not work
        # given what I did with the release serializer
        # it will instead rely on tagstore. Not sure how to fix this.
        # response = self.client.get(url, format='json')
        # self.assert_releases(response, [self.release1, self.release3])
        # releases = sort_releases_by_version(response.data)
        # self.assert_release_details(
        #     release=releases[0],
        #     new_issues_count=8,
        #     first_seen=self.datetime,
        #     last_seen=self.datetime + timedelta(seconds=700),
        # )
        # self.assert_release_details(
        #     release=releases[1],
        #     new_issues_count=2,
        #     first_seen=self.datetime,
        #     last_seen=self.datetime + timedelta(days=20),
        # )

        response = self.client.get(url + "?environment=" + self.env1.name, format="json")
        self.assert_releases(response, [self.release1])
        releases = sort_releases_by_version(response.data)
        self.assert_release_details(
            release=releases[0],
            new_issues_count=1,
            first_seen=self.datetime,
            last_seen=self.datetime,
        )

        response = self.client.get(url + "?environment=" + self.env3.name, format="json")
        self.assert_releases(response, [self.release1, self.release3])
        releases = sort_releases_by_version(response.data)
        self.assert_release_details(
            release=releases[0],
            new_issues_count=7,
            first_seen=self.datetime + timedelta(seconds=120),
            last_seen=self.datetime + timedelta(seconds=700),
        )
        self.assert_release_details(
            release=releases[1],
            new_issues_count=2,
            first_seen=self.datetime,
            last_seen=self.datetime + timedelta(days=20),
        )


@region_silo_test
class ProjectReleaseCreateTest(APITestCase):
    def test_minimal(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url,
            data={"version": "1.2.1"},
            HTTP_USER_AGENT="sentry-cli/2.77.4",
        )

        assert response.status_code == 201, response.content
        assert response.data["version"]

        release = Release.objects.get(
            version=response.data["version"],
            user_agent="sentry-cli/2.77.4",
        )
        assert not release.owner_id
        assert release.organization == project.organization
        assert release.projects.first() == project

    def test_ios_release(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, data={"version": "1.2.1 (123)"})

        assert response.status_code == 201, response.content
        assert response.data["version"]

        release = Release.objects.get(version=response.data["version"])
        assert not release.owner_id
        assert release.organization == project.organization
        assert release.projects.first() == project

    def test_duplicate(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(version="1.2.1", organization_id=project.organization_id)
        release.add_project(project)

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.post(url, data={"version": "1.2.1"})

        assert response.status_code == 208, response.content

    def test_duplicate_across_org(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(version="1.2.1", organization_id=project.organization_id)
        release.add_project(project)

        project2 = self.create_project(name="bar", organization=project.organization)

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project2.organization.slug, "project_slug": project2.slug},
        )

        response = self.client.post(url, data={"version": "1.2.1"})

        # since project2 was added, should be 201
        assert response.status_code == 201, response.content
        assert (
            Release.objects.filter(version="1.2.1", organization_id=project.organization_id).count()
            == 1
        )
        assert ReleaseProject.objects.get(release=release, project=project)
        assert ReleaseProject.objects.get(release=release, project=project2)

    def test_version_whitespace(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.post(url, data={"version": "1.2.3\n"})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "\n1.2.3"})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "1.\n2.3"})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "1.2.3\f"})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "1.2.3\t"})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "1.2.3"})
        assert response.status_code == 201, response.content
        assert response.data["version"] == "1.2.3"

        release = Release.objects.get(
            organization_id=project.organization_id, version=response.data["version"]
        )
        assert not release.owner_id

    def test_features(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, data={"version": "1.2.1", "owner": self.user.email})

        assert response.status_code == 201, response.content
        assert response.data["version"]

        release = Release.objects.get(
            organization_id=project.organization_id, version=response.data["version"]
        )
        assert release.owner_id == self.user.id

    def test_commits(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url, data={"version": "1.2.1", "commits": [{"id": "a" * 40}, {"id": "b" * 40}]}
        )

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data["version"]

        release = Release.objects.get(
            organization_id=project.organization_id, version=response.data["version"]
        )

        rc_list = list(
            ReleaseCommit.objects.filter(release=release)
            .select_related("commit", "commit__author")
            .order_by("order")
        )
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id

    def test_org_auth_token(self):
        org = self.create_organization()
        org2 = self.create_organization()

        team1 = self.create_team(organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=datetime(2013, 8, 13, 3, 8, 24, 880386)
        )
        release1.add_project(project1)

        url = reverse(
            "sentry-api-0-project-releases",
            kwargs={"organization_slug": org.slug, "project_slug": project1.slug},
        )

        # test right org, wrong permissions level
        with assume_test_silo_mode(SiloMode.CONTROL):
            bad_token_str = generate_token(org.slug, "")
            OrgAuthToken.objects.create(
                organization_id=org.id,
                name="token 1",
                token_hashed=hash_token(bad_token_str),
                token_last_characters="ABCD",
                scope_list=[],
                date_last_used=None,
            )
        response = self.client.post(
            url,
            data={"version": "1.2.1"},
            HTTP_AUTHORIZATION=f"Bearer {bad_token_str}",
        )
        assert response.status_code == 403

        # test wrong org, right permissions level
        with assume_test_silo_mode(SiloMode.CONTROL):
            wrong_org_token_str = generate_token(org2.slug, "")
            OrgAuthToken.objects.create(
                organization_id=org2.id,
                name="token 1",
                token_hashed=hash_token(wrong_org_token_str),
                token_last_characters="ABCD",
                scope_list=["org:ci"],
                date_last_used=None,
            )
        response = self.client.post(
            url,
            data={"version": "1.2.1"},
            HTTP_AUTHORIZATION=f"Bearer {wrong_org_token_str}",
        )
        assert response.status_code == 403

        # test right org, right permissions level
        with assume_test_silo_mode(SiloMode.CONTROL):
            good_token_str = generate_token(org.slug, "")
            OrgAuthToken.objects.create(
                organization_id=org.id,
                name="token 1",
                token_hashed=hash_token(good_token_str),
                token_last_characters="ABCD",
                scope_list=["org:ci"],
                date_last_used=None,
            )

        with outbox_runner():
            response = self.client.post(
                url,
                data={"version": "1.2.1"},
                HTTP_AUTHORIZATION=f"Bearer {good_token_str}",
            )
        assert response.status_code == 201, response.content

        # Make sure org token usage was updated
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_token = OrgAuthToken.objects.get(token_hashed=hash_token(good_token_str))
        assert org_token.date_last_used is not None
        assert org_token.project_last_used_id == project1.id


@region_silo_test
class ProjectReleaseCreateCommitPatch(ReleaseCommitPatchTest):
    @cached_property
    def url(self):
        return reverse(
            "sentry-api-0-project-releases",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_commits_with_patch_set(self):
        response = self.client.post(
            self.url,
            data={
                "version": "2d1ab93fe4bb42db80890f01f8358fc9f8fbff3b",
                "projects": [self.project.slug],
                "commits": [
                    {
                        "patch_set": [
                            {"path": "hello.py", "type": "M"},
                            {"path": "templates/hola.html", "type": "D"},
                        ],
                        "repository": "laurynsentry/helloworld",
                        "author_email": "lauryndbrown@gmail.com",
                        "timestamp": "2018-11-29T18:50:28+03:00",
                        "author_name": "Lauryn Brown",
                        "message": "made changes to hello.",
                        "id": "2d1ab93fe4bb42db80890f01f8358fc9f8fbff3b",
                    },
                    {
                        "patch_set": [
                            {"path": "templates/hello.html", "type": "M"},
                            {"path": "templates/goodbye.html", "type": "A"},
                        ],
                        "repository": "laurynsentry/helloworld",
                        "author_email": "lauryndbrown@gmail.com",
                        "timestamp": "2018-11-30T22:51:14+03:00",
                        "author_name": "Lauryn Brown",
                        "message": "Changed release",
                        "id": "be2fe070f6d1b8a572b67defc87af2582f9b0d78",
                    },
                ],
            },
        )

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data["version"]

        release = Release.objects.get(organization_id=self.org.id, version=response.data["version"])

        repo = Repository.objects.get(organization_id=self.org.id, name="laurynsentry/helloworld")
        assert repo.provider is None

        rc_list = list(
            ReleaseCommit.objects.filter(release=release).select_related("commit", "commit__author")
        )
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id

        author = CommitAuthor.objects.get(
            organization_id=self.org.id, email="lauryndbrown@gmail.com"
        )
        assert author.name == "Lauryn Brown"

        commits = [rc.commit for rc in rc_list]
        commits.sort(key=lambda c: c.date_added)

        self.assert_commit(
            commit=commits[0],
            repo_id=repo.id,
            key="2d1ab93fe4bb42db80890f01f8358fc9f8fbff3b",
            author_id=author.id,
            message="made changes to hello.",
        )

        self.assert_commit(
            commit=commits[1],
            repo_id=repo.id,
            key="be2fe070f6d1b8a572b67defc87af2582f9b0d78",
            author_id=author.id,
            message="Changed release",
        )

        file_changes = CommitFileChange.objects.filter(organization_id=self.org.id).order_by(
            "filename"
        )

        self.assert_file_change(file_changes[0], "M", "hello.py", commits[0].id)
        self.assert_file_change(file_changes[1], "A", "templates/goodbye.html", commits[1].id)
        self.assert_file_change(file_changes[2], "M", "templates/hello.html", commits[1].id)
        self.assert_file_change(file_changes[3], "D", "templates/hola.html", commits[0].id)

    def test_invalid_patch_type(self):
        response = self.client.post(
            self.url,
            data={
                "version": "2d1ab93fe4bb42db80890f01f8358fc9f8fbff3b",
                "projects": [self.project.slug],
                "commits": [
                    {
                        "patch_set": [
                            {"path": "hello.py", "type": "Z"},
                            {"path": "templates/hola.html", "type": "D"},
                        ],
                        "repository": "laurynsentry/helloworld",
                        "author_email": "lauryndbrown@gmail.com",
                        "timestamp": "2018-11-29T18:50:28+03:00",
                        "author_name": "Lauryn Brown",
                        "message": "made changes to hello.",
                        "id": "2d1ab93fe4bb42db80890f01f8358fc9f8fbff3b",
                    }
                ],
            },
        )

        assert response.status_code == 400
        assert response.json() == {
            "commits": {
                "patch_set": {
                    "type": [
                        "Commit patch_set type Z is not supported.",
                    ]
                }
            }
        }


@region_silo_test
class ReleaseSerializerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.version = "1234567890"
        self.repo_name = "repo/name"
        self.repo2_name = "repo2/name"
        self.commits = [{"id": "a" * 40}, {"id": "b" * 40}]
        self.ref = "master"
        self.url = "https://example.com"
        self.dateReleased = "1000-10-10T06:06"

    def test_simple(self):
        serializer = ReleaseWithVersionSerializer(
            data={
                "version": self.version,
                "owner": self.user.username,
                "ref": self.ref,
                "url": self.url,
                "dateReleased": self.dateReleased,
                "commits": self.commits,
            },
            context={"organization": self.organization},
        )

        assert serializer.is_valid()
        assert sorted(serializer.fields.keys()) == sorted(
            ["version", "owner", "ref", "url", "dateReleased", "commits", "status"]
        )

        result = serializer.validated_data
        assert result["version"] == self.version
        assert result["owner"]
        assert result["owner"].id == self.user.id
        assert result["owner"].username == self.user.username
        assert result["ref"] == self.ref
        assert result["url"] == self.url
        assert result["dateReleased"] == datetime(1000, 10, 10, 6, 6, tzinfo=timezone.utc)
        assert result["commits"] == self.commits

    def test_fields_not_required(self):
        serializer = ReleaseWithVersionSerializer(
            data={"version": self.version},
            context={"organization": self.organization},
        )
        assert serializer.is_valid()

    def test_do_not_allow_null_commits(self):
        serializer = ReleaseWithVersionSerializer(
            data={"version": self.version, "commits": None},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_ref_limited_by_max_version_length(self):
        serializer = ReleaseWithVersionSerializer(
            data={"version": self.version, "ref": "a" * MAX_VERSION_LENGTH},
            context={"organization": self.organization},
        )
        assert serializer.is_valid()
        serializer = ReleaseWithVersionSerializer(
            data={"version": self.version, "ref": "a" * (MAX_VERSION_LENGTH + 1)},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_version_limited_by_max_version_length(self):
        serializer = ReleaseWithVersionSerializer(
            data={"version": "a" * MAX_VERSION_LENGTH},
            context={"organization": self.organization},
        )
        assert serializer.is_valid()
        serializer = ReleaseWithVersionSerializer(
            data={"version": "a" * (MAX_VERSION_LENGTH + 1)},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_version_does_not_allow_whitespace(self):
        for char in BAD_RELEASE_CHARS:
            serializer = ReleaseWithVersionSerializer(
                data={"version": char},
                context={"organization": self.organization},
            )
            assert not serializer.is_valid()

    def test_version_does_not_allow_current_dir_path(self):
        serializer = ReleaseWithVersionSerializer(
            data={"version": "."},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()
        serializer = ReleaseWithVersionSerializer(
            data={"version": ".."},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_version_does_not_allow_null_or_empty_value(self):
        serializer = ReleaseWithVersionSerializer(
            data={"version": None},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()
        serializer = ReleaseWithVersionSerializer(
            data={"version": ""},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_version_cannot_be_latest(self):
        serializer = ReleaseWithVersionSerializer(
            data={"version": "Latest"},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_owner_must_have_org_access(self):
        serializer = ReleaseWithVersionSerializer(
            data={
                "version": self.version,
                "owner": self.create_user().username,
                "ref": self.ref,
                "url": self.url,
                "dateReleased": self.dateReleased,
                "commits": self.commits,
            },
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()
        assert serializer.errors == {
            "owner": [ErrorDetail("User does not have access to this organization", "invalid")]
        }
