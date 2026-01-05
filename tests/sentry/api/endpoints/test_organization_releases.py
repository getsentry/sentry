import unittest
from datetime import UTC, datetime, timedelta
from functools import cached_property
from unittest.mock import MagicMock, patch

import pytest
from django.urls import reverse
from django.utils import timezone

from sentry.api.endpoints.organization_releases import ReleaseSerializerWithProjects
from sentry.api.release_search import FINALIZED_KEY, RELEASE_CREATED_KEY
from sentry.api.serializers.rest_framework.release import ReleaseHeadCommitSerializer
from sentry.auth import access
from sentry.constants import BAD_RELEASE_CHARS, MAX_COMMIT_LENGTH, MAX_VERSION_LENGTH
from sentry.locks import locks
from sentry.models.activity import Activity
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.environment import Environment
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment, ReleaseStages
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.repository import Repository
from sentry.plugins.providers.dummy.repository import DummyRepositoryProvider
from sentry.search.events.constants import (
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import (
    APITestCase,
    BaseMetricsTestCase,
    ReleaseCommitPatchTest,
    SetRefsTestCase,
    TestCase,
)
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token

pytestmark = [requires_snuba, pytest.mark.sentry_metrics]


class OrganizationReleaseListTest(APITestCase, BaseMetricsTestCase):
    endpoint = "sentry-api-0-organization-releases"

    def assert_expected_versions(self, response, expected):
        assert [item["version"] for item in response.data] == [e.version for e in expected]

    def test_simple(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org2)
        project3 = self.create_project(teams=[team1], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org2.id,
            version="2",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release3.add_project(project3)

        release4 = Release.objects.create(
            organization_id=org.id,
            version="4",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release4.add_project(project3)

        response = self.get_success_response(org.slug)
        self.assert_expected_versions(response, [release4, release1, release3])

    def test_release_list_order_by_date_added(self) -> None:
        """
        Test that ensures that by relying on the default date sorting, releases
        will only be sorted according to `Release.date_added`, and
        `Release.date_released` should have no effect whatsoever on that order
        """
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        release6 = Release.objects.create(
            organization_id=org.id,
            version="6",
            date_added=datetime(2013, 8, 10, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 20, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release6.add_project(project)

        release7 = Release.objects.create(
            organization_id=org.id,
            version="7",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 18, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release7.add_project(project)

        release8 = Release.objects.create(
            organization_id=org.id,
            version="8",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 16, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release8.add_project(project)

        response = self.get_success_response(org.slug)
        self.assert_expected_versions(response, [release8, release7, release6])

    def test_release_list_order_by_sessions_empty(self) -> None:
        self.login_as(user=self.user)

        release_1 = self.create_release(version="1")
        release_2 = self.create_release(version="2")
        release_3 = self.create_release(version="3")
        release_4 = self.create_release(version="4")
        release_5 = self.create_release(version="5")

        #  Make sure ordering works fine when we have no session data at all
        response = self.get_success_response(self.organization.slug, sort="sessions", flatten="1")
        self.assert_expected_versions(
            response, [release_5, release_4, release_3, release_2, release_1]
        )

    def test_release_list_order_by_sessions(self) -> None:
        self.login_as(user=self.user)

        release_1 = self.create_release(version="1")
        self.store_session(self.build_session(release=release_1))
        release_2 = self.create_release(version="2")
        release_3 = self.create_release(version="3")
        release_4 = self.create_release(version="4")
        release_5 = self.create_release(version="5")
        self.bulk_store_sessions([self.build_session(release=release_5) for _ in range(2)])

        response = self.get_success_response(self.organization.slug, sort="sessions", flatten="1")
        self.assert_expected_versions(
            response, [release_5, release_1, release_4, release_3, release_2]
        )

        response = self.get_success_response(
            self.organization.slug, sort="sessions", flatten="1", per_page=1
        )
        self.assert_expected_versions(response, [release_5])
        response = self.get_success_response(
            self.organization.slug,
            sort="sessions",
            flatten="1",
            per_page=1,
            cursor=self.get_cursor_headers(response)[1],
        )
        self.assert_expected_versions(response, [release_1])
        response = self.get_success_response(
            self.organization.slug,
            sort="sessions",
            flatten="1",
            per_page=1,
            cursor=self.get_cursor_headers(response)[1],
        )
        self.assert_expected_versions(response, [release_4])
        response = self.get_success_response(
            self.organization.slug,
            sort="sessions",
            flatten="1",
            per_page=1,
            cursor=self.get_cursor_headers(response)[1],
        )
        self.assert_expected_versions(response, [release_3])
        response = self.get_success_response(
            self.organization.slug,
            sort="sessions",
            flatten="1",
            per_page=1,
            cursor=self.get_cursor_headers(response)[1],
        )
        self.assert_expected_versions(response, [release_2])

        response = self.get_success_response(
            self.organization.slug, sort="sessions", flatten="1", per_page=3
        )
        self.assert_expected_versions(response, [release_5, release_1, release_4])
        response = self.get_success_response(
            self.organization.slug,
            sort="sessions",
            flatten="1",
            per_page=3,
            cursor=self.get_cursor_headers(response)[1],
        )
        self.assert_expected_versions(response, [release_3, release_2])

    def test_release_list_order_by_build_number(self) -> None:
        self.login_as(user=self.user)
        release_1 = self.create_release(version="test@1.2+1000")
        release_2 = self.create_release(version="test@1.2+1")
        release_3 = self.create_release(version="test@1.2+200")
        self.create_release(version="test@1.2")
        self.create_release(version="test@1.2+500alpha")

        response = self.get_success_response(self.organization.slug, sort="build")
        self.assert_expected_versions(response, [release_1, release_3, release_2])

    def test_release_list_order_by_semver(self) -> None:
        self.login_as(user=self.user)
        release_1 = self.create_release(version="test@2.2")
        release_2 = self.create_release(version="test@10.0+122")
        release_3 = self.create_release(version="test@2.2-alpha")
        release_4 = self.create_release(version="test@2.2.3")
        release_5 = self.create_release(version="test@2.20.3")
        release_6 = self.create_release(version="test@2.20.3.3")
        release_7 = self.create_release(version="test@10.0+123")
        release_8 = self.create_release(version="test@some_thing")
        release_9 = self.create_release(version="random_junk")

        response = self.get_success_response(self.organization.slug, sort="semver")
        self.assert_expected_versions(
            response,
            [
                release_7,
                release_2,
                release_6,
                release_5,
                release_4,
                release_1,
                release_3,
                release_9,
                release_8,
            ],
        )

    def test_query_filter(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        release = Release.objects.create(
            organization_id=org.id,
            version="foobar",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release.add_project(project)

        release2 = Release.objects.create(
            organization_id=org.id,
            version="sdfsdfsdf",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(project)

        response = self.get_success_response(org.slug, query="oob")
        self.assert_expected_versions(response, [release])

        response = self.get_success_response(org.slug, query="baz")
        self.assert_expected_versions(response, [])

    def test_release_filter(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        release = Release.objects.create(
            organization_id=org.id,
            version="foobar",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880387, tzinfo=UTC),
        )
        release.add_project(project)

        release2 = Release.objects.create(
            organization_id=org.id,
            version="release2",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(project)

        response = self.get_success_response(
            self.organization.slug, query=f"{RELEASE_ALIAS}:foobar"
        )
        self.assert_expected_versions(response, [release])

        response = self.get_success_response(self.organization.slug, query=f"{RELEASE_ALIAS}:foo*")
        self.assert_expected_versions(response, [release])

        response = self.get_success_response(self.organization.slug, query=f"{RELEASE_ALIAS}:baz")
        self.assert_expected_versions(response, [])

        response = self.get_success_response(
            self.organization.slug, query=f"{RELEASE_ALIAS}:[foobar]"
        )
        self.assert_expected_versions(response, [release])

        response = self.get_success_response(
            self.organization.slug, query=f"{RELEASE_ALIAS}:[foobar,release2]"
        )
        self.assert_expected_versions(response, [release, release2])

        # NOT release
        response = self.get_success_response(
            self.organization.slug, query=f"!{RELEASE_ALIAS}:foobar"
        )
        self.assert_expected_versions(response, [release2])

        response = self.get_success_response(
            self.organization.slug, query=f"!{RELEASE_ALIAS}:[foobar]"
        )
        self.assert_expected_versions(response, [release2])

        response = self.get_success_response(
            self.organization.slug, query=f"!{RELEASE_ALIAS}:[foobar,release2]"
        )
        self.assert_expected_versions(response, [])

    def test_latest_release_filter(self) -> None:
        self.login_as(user=self.user)

        project1 = self.create_project(teams=[self.team], organization=self.organization)
        project2 = self.create_project(teams=[self.team], organization=self.organization)

        self.create_release(version="test@2.2", project=project1)
        self.create_release(version="test@2.2-alpha", project=project1)
        project1_latest_release = self.create_release(version="test@2.2+122", project=project1)
        self.create_release(version="test@20.2.8", project=project2)
        project2_latest_release = self.create_release(version="test@21.0.0", project=project2)

        response = self.get_success_response(
            self.organization.slug, query=f"{RELEASE_ALIAS}:latest"
        )
        self.assert_expected_versions(
            response,
            [
                project2_latest_release,
                project1_latest_release,
            ],
        )

    def test_query_filter_suffix(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        release = Release.objects.create(
            organization_id=org.id,
            version="com.foo.BarApp@1.0+1234",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release.add_project(project)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.get(url + "?query=1.0+(1234)", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["version"] == release.version

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.get(url + "?query=1.0%2B1234", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["version"] == release.version

    def test_semver_filter(self) -> None:
        self.login_as(user=self.user)

        release_1 = self.create_release(version="test@1.2.4+124")
        release_2 = self.create_release(version="test@1.2.3+123")
        release_3 = self.create_release(version="test2@1.2.5+125")
        release_4 = self.create_release(version="some.release")

        response = self.get_success_response(self.organization.slug, query=f"{SEMVER_ALIAS}:>1.2.3")
        self.assert_expected_versions(response, [release_3, release_1])

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_ALIAS}:>=1.2.3"
        )
        self.assert_expected_versions(response, [release_3, release_2, release_1])

        response = self.get_success_response(self.organization.slug, query=f"{SEMVER_ALIAS}:1.2.*")
        self.assert_expected_versions(response, [release_3, release_2, release_1])

        # NOT semver version
        response = self.get_success_response(self.organization.slug, query=f"!{SEMVER_ALIAS}:1.2.3")
        self.assert_expected_versions(response, [release_4, release_3, release_1])

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_ALIAS}:>=1.2.3", sort="semver"
        )
        self.assert_expected_versions(response, [release_3, release_1, release_2])

        response = self.get_success_response(self.organization.slug, query=f"{SEMVER_ALIAS}:2.2.1")
        self.assert_expected_versions(response, [])

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_PACKAGE_ALIAS}:test2"
        )
        self.assert_expected_versions(response, [release_3])

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_PACKAGE_ALIAS}:test"
        )
        self.assert_expected_versions(response, [release_2, release_1])

        # NOT semver package
        response = self.get_success_response(
            self.organization.slug, query=f"!{SEMVER_PACKAGE_ALIAS}:test2"
        )
        self.assert_expected_versions(response, [release_4, release_2, release_1])

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_BUILD_ALIAS}:>124"
        )
        self.assert_expected_versions(response, [release_3])

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_BUILD_ALIAS}:<125"
        )
        self.assert_expected_versions(response, [release_2, release_1])

        # NOT semver build
        response = self.get_success_response(
            self.organization.slug, query=f"!{SEMVER_BUILD_ALIAS}:125"
        )
        self.assert_expected_versions(response, [release_4, release_2, release_1])

    def test_release_stage_filter(self) -> None:
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:adopted",
            environment=self.environment.name,
        )
        assert [r["version"] for r in response.data] == []

        replaced_release = self.create_release(version="replaced_release")
        adopted_release = self.create_release(version="adopted_release")
        not_adopted_release = self.create_release(version="not_adopted_release")
        adopted_rpe = ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=adopted_release.id,
            environment_id=self.environment.id,
            adopted=timezone.now(),
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=replaced_release.id,
            environment_id=self.environment.id,
            adopted=timezone.now() - timedelta(minutes=5),
            unadopted=timezone.now(),
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=not_adopted_release.id,
            environment_id=self.environment.id,
        )

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}",
            environment=self.environment.name,
        )
        self.assert_expected_versions(response, [adopted_release])

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.LOW_ADOPTION.value}",
            environment=self.environment.name,
        )
        self.assert_expected_versions(response, [not_adopted_release])

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.REPLACED.value}",
            environment=self.environment.name,
        )
        self.assert_expected_versions(response, [replaced_release])

        # NOT release stage
        response = self.get_success_response(
            self.organization.slug,
            query=f"!{RELEASE_STAGE_ALIAS}:{ReleaseStages.REPLACED.value}",
            environment=self.environment.name,
        )
        self.assert_expected_versions(response, [not_adopted_release, adopted_release])

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED.value},{ReleaseStages.REPLACED.value}]",
            environment=self.environment.name,
        )
        self.assert_expected_versions(response, [adopted_release, replaced_release])

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.LOW_ADOPTION.value}]",
            environment=self.environment.name,
        )

        self.assert_expected_versions(response, [not_adopted_release])

        response = self.get_success_response(
            self.organization.slug,
            sort="adoption",
        )
        self.assert_expected_versions(
            response, [adopted_release, replaced_release, not_adopted_release]
        )
        adopted_rpe.update(adopted=timezone.now() - timedelta(minutes=15))

        # Replaced should come first now.
        response = self.get_success_response(
            self.organization.slug,
            sort="adoption",
        )
        self.assert_expected_versions(
            response, [replaced_release, adopted_release, not_adopted_release]
        )

        response = self.get_success_response(self.organization.slug, sort="adoption", per_page=1)
        self.assert_expected_versions(response, [replaced_release])
        next_cursor = self.get_cursor_headers(response)[1]
        response = self.get_success_response(
            self.organization.slug,
            sort="adoption",
            per_page=1,
            cursor=next_cursor,
        )
        self.assert_expected_versions(response, [adopted_release])
        next_cursor = self.get_cursor_headers(response)[1]
        response = self.get_success_response(
            self.organization.slug,
            sort="adoption",
            per_page=1,
            cursor=next_cursor,
        )
        prev_cursor = self.get_cursor_headers(response)[0]
        self.assert_expected_versions(response, [not_adopted_release])
        response = self.get_success_response(
            self.organization.slug,
            sort="adoption",
            per_page=1,
            cursor=prev_cursor,
        )
        prev_cursor = self.get_cursor_headers(response)[0]
        self.assert_expected_versions(response, [adopted_release])
        response = self.get_success_response(
            self.organization.slug,
            sort="adoption",
            per_page=1,
            cursor=prev_cursor,
        )
        prev_cursor = self.get_cursor_headers(response)[0]
        self.assert_expected_versions(response, [replaced_release])

        adopted_rpe.update(adopted=timezone.now() - timedelta(minutes=15))

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.LOW_ADOPTION.value},{ReleaseStages.REPLACED.value}]",
            sort="adoption",
            environment=self.environment.name,
        )
        self.assert_expected_versions(response, [replaced_release, not_adopted_release])

        response = self.get_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:invalid_stage",
            environment=self.environment.name,
        )
        assert response.status_code == 400

        response = self.get_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}",
            # No environment
        )
        assert response.status_code == 400

    def test_project_permissions(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org.id,
            version="2",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release3.add_project(project1)

        ax = access.from_user(user, org)
        assert ax.has_projects_access([project1])
        assert ax.has_project_membership(project1)
        assert not ax.has_project_membership(project2)

        response = self.get_success_response(org.slug)
        self.assert_expected_versions(response, [release1, release3])

    def test_project_permissions_open_access(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = True
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org.id,
            version="2",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release3.add_project(project1)

        ax = access.from_user(user, org)
        assert ax.has_projects_access([project1, project2])
        assert ax.has_project_membership(project1)
        assert not ax.has_project_membership(project2)

        response = self.get_success_response(org.slug)
        self.assert_expected_versions(response, [release1, release3])

    def test_all_projects_parameter(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = True
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org.id,
            version="2",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(project2)

        response = self.get_success_response(org.slug, project=[-1])
        self.assert_expected_versions(response, [release2, release1])

    def test_new_org(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        team = self.create_team(organization=org)
        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)
        response = self.get_success_response(org.slug)
        self.assert_expected_versions(response, [])

    def test_archive_release(self) -> None:
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-releases",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

        # test legacy status value of None (=open)
        self.release.status = None
        self.release.save()

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        (release_data,) = response.data

        response = self.client.post(
            url,
            format="json",
            data={
                "version": release_data["version"],
                "projects": [x["slug"] for x in release_data["projects"]],
                "status": "archived",
            },
        )
        assert response.status_code == 208, response.content

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + "?status=archived", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        response = self.client.get(url + "?status=", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

    def test_disallow_archive_release_when_no_open_membership(self) -> None:
        release = self.create_release(project=self.project, version="test@1.0")

        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # user has no access to all the projects
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        url = reverse(
            "sentry-api-0-organization-releases",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

        # trying to archive the release
        response = self.client.post(
            url,
            format="json",
            data={
                "version": release.version,
                "projects": [],
                "status": "archived",
            },
        )
        assert response.status_code == 400
        assert b"You do not have permission to one of the projects: bar" in response.content

    def test_disallow_projects_update_for_release_when_no_open_membership(self) -> None:
        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)

        project1 = self.create_project(
            name="not_yours", teams=[team1], organization=self.organization
        )
        project2 = self.create_project(teams=[team2], organization=self.organization)

        release = self.create_release(project=project1, version="test@1.0")

        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # user has no access to projects of team1
        user_team2 = self.create_user(is_superuser=False)
        self.create_member(
            user=user_team2, organization=self.organization, role="member", teams=[team2]
        )
        self.login_as(user_team2)

        url = reverse(
            "sentry-api-0-organization-releases",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

        # trying to update projects of the release
        response = self.client.post(
            url,
            format="json",
            data={
                "version": release.version,
                "projects": [project2.slug],
            },
        )
        assert response.status_code == 400
        assert b"You do not have permission to one of the projects: not_yours" in response.content


class OrganizationReleasesStatsTest(APITestCase):
    endpoint = "sentry-api-0-organization-releases-stats"

    def setUp(self) -> None:
        self.project1 = self.create_project(teams=[self.team], organization=self.organization)
        self.project2 = self.create_project(teams=[self.team], organization=self.organization)
        self.project3 = self.create_project(teams=[self.team], organization=self.organization)

        self.login_as(user=self.user)

    def test_simple(self) -> None:
        release1 = Release.objects.create(
            organization_id=self.organization.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(self.project1)

        release2 = Release.objects.create(
            organization_id=self.organization.id,
            version="2",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(self.project2)

        release3 = Release.objects.create(
            organization_id=self.organization.id,
            version="3",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release3.add_project(self.project3)

        url = reverse(
            "sentry-api-0-organization-releases-stats",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        assert response.data[0]["version"] == release3.version
        assert response.data[0]["date"] == release3.date_added
        assert response.data[1]["version"] == release1.version
        assert response.data[1]["date"] == release1.date_added
        assert response.data[2]["version"] == release2.version
        assert response.data[2]["date"] == release2.date_added

    def test_release_list_order_by_date_added(self) -> None:
        """
        Test that ensures that by relying on the default date sorting, releases
        will only be sorted according to `Release.date_added`, and
        `Release.date_released` should have no effect whatsoever on that order
        """
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        release6 = Release.objects.create(
            organization_id=org.id,
            version="6",
            date_added=datetime(2013, 8, 10, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 20, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release6.add_project(project)

        release7 = Release.objects.create(
            organization_id=org.id,
            version="7",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 18, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release7.add_project(project)

        release8 = Release.objects.create(
            organization_id=org.id,
            version="8",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 16, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release8.add_project(project)

        url = reverse(
            "sentry-api-0-organization-releases-stats",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0]["version"] == release8.version
        assert response.data[1]["version"] == release7.version
        assert response.data[2]["version"] == release6.version

    def test_with_adoption_stages(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.save()
        team1 = self.create_team(organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)
        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)
        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.get(f"{url}?adoptionStages=1", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert "adoptionStages" in response.data[0]

    def test_semver_filter(self) -> None:
        self.login_as(user=self.user)

        release_1 = self.create_release(version="test@1.2.4")
        release_2 = self.create_release(version="test@1.2.3")
        release_3 = self.create_release(version="test2@1.2.5")
        self.create_release(version="some.release")

        response = self.get_success_response(self.organization.slug, query=f"{SEMVER_ALIAS}:>1.2.3")
        assert [r["version"] for r in response.data] == [release_3.version, release_1.version]

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_ALIAS}:>=1.2.3"
        )
        assert [r["version"] for r in response.data] == [
            release_3.version,
            release_2.version,
            release_1.version,
        ]

        response = self.get_success_response(self.organization.slug, query=f"{SEMVER_ALIAS}:1.2.*")
        assert [r["version"] for r in response.data] == [
            release_3.version,
            release_2.version,
            release_1.version,
        ]

        response = self.get_success_response(self.organization.slug, query=f"{SEMVER_ALIAS}:2.2.1")
        assert [r["version"] for r in response.data] == []

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_PACKAGE_ALIAS}:test2"
        )
        assert [r["version"] for r in response.data] == [release_3.version]

        response = self.get_success_response(
            self.organization.slug, query=f"{SEMVER_PACKAGE_ALIAS}:test"
        )
        assert [r["version"] for r in response.data] == [release_2.version, release_1.version]

    def test_finalized_filter(self) -> None:
        self.login_as(user=self.user)

        release_1 = self.create_release(
            version="test@1.2.3", date_released=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC)
        )
        release_2 = self.create_release(version="test@1.2.4", date_released=None)
        release_3 = self.create_release(version="test2@1.2.5", date_released=None)
        release_4 = self.create_release(version="test2@1.2.6")

        url = reverse(
            "sentry-api-0-organization-releases",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        response = self.client.get(url + f"?query={FINALIZED_KEY}:true", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert [r["version"] for r in response.data] == [release_1.version]

        response = self.client.get(url + f"?query={FINALIZED_KEY}:false", format="json")
        assert [r["version"] for r in response.data] == [
            release_4.version,
            release_3.version,
            release_2.version,
        ]

        # if anything besides "true" or "false" is parsed, return all releases
        response = self.client.get(url + f"?query={FINALIZED_KEY}:wrong_value", format="json")
        assert [r["version"] for r in response.data] == [
            release_4.version,
            release_3.version,
            release_2.version,
            release_1.version,
        ]

    def test_release_created_filter(self) -> None:
        self.login_as(user=self.user)

        now = timezone.now()
        one_day_ago = now - timedelta(days=1)
        one_week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        release_1 = self.create_release(version="release-1", date_added=two_weeks_ago)
        release_2 = self.create_release(version="release-2", date_added=one_week_ago)
        release_3 = self.create_release(version="release-3", date_added=one_day_ago)
        release_4 = self.create_release(version="release-4", date_added=now)

        # Test relative date filter: releases created in the last 3 days
        response = self.get_success_response(
            self.organization.slug, query=f"{RELEASE_CREATED_KEY}:-3d"
        )
        assert [r["version"] for r in response.data] == [
            release_4.version,
            release_3.version,
        ]

        # Test comparison operator: releases created after a specific date
        formatted_date = one_week_ago.strftime("%Y-%m-%dT%H:%M:%S")
        response = self.get_success_response(
            self.organization.slug, query=f"{RELEASE_CREATED_KEY}:>={formatted_date}"
        )
        assert [r["version"] for r in response.data] == [
            release_4.version,
            release_3.version,
            release_2.version,
        ]

        # Test comparison operator: releases created before a specific date
        response = self.get_success_response(
            self.organization.slug, query=f"{RELEASE_CREATED_KEY}:<{formatted_date}"
        )
        assert [r["version"] for r in response.data] == [release_1.version]

    def test_release_stage_filter(self) -> None:
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:adopted",
            environment=self.environment.name,
        )
        assert [r["version"] for r in response.data] == []

        replaced_release = self.create_release(version="replaced_release")
        adopted_release = self.create_release(version="adopted_release")
        not_adopted_release = self.create_release(version="not_adopted_release")
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=adopted_release.id,
            environment_id=self.environment.id,
            adopted=timezone.now(),
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=replaced_release.id,
            environment_id=self.environment.id,
            adopted=timezone.now(),
            unadopted=timezone.now(),
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=not_adopted_release.id,
            environment_id=self.environment.id,
        )

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}",
            environment=self.environment.name,
        )
        assert [r["version"] for r in response.data] == [adopted_release.version]

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.LOW_ADOPTION.value}",
            environment=self.environment.name,
        )
        assert [r["version"] for r in response.data] == [not_adopted_release.version]

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.REPLACED.value}",
            environment=self.environment.name,
        )
        assert [r["version"] for r in response.data] == [replaced_release.version]

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED.value},{ReleaseStages.REPLACED.value}]",
            environment=self.environment.name,
        )
        assert [r["version"] for r in response.data] == [
            adopted_release.version,
            replaced_release.version,
        ]

        response = self.get_success_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.LOW_ADOPTION.value}]",
            environment=self.environment.name,
        )
        assert [r["version"] for r in response.data] == [not_adopted_release.version]

        response = self.get_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:invalid_stage",
            environment=self.environment.name,
        )
        assert response.status_code == 400

        response = self.get_response(
            self.organization.slug,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}",
            # No environment
        )
        assert response.status_code == 400

    def test_multi_project_release_gets_filtered(self) -> None:
        multi_project_release = self.create_release(version="multi_project_release")
        single_project_release = self.create_release(version="single_project_release")
        project2 = self.create_project(teams=[self.team], organization=self.organization)

        # One project not adopted
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=multi_project_release.id,
            environment_id=self.environment.id,
        )
        # One project adopted
        ReleaseProjectEnvironment.objects.create(
            project_id=project2.id,
            release_id=multi_project_release.id,
            environment_id=self.environment.id,
            adopted=timezone.now(),
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=single_project_release.id,
            environment_id=self.environment.id,
            adopted=timezone.now(),
        )

        # Filtering to self.environment.name and self.project with release.stage:adopted should NOT return multi_project_release.
        response = self.get_success_response(
            self.organization.slug,
            project=self.project.id,
            environment=self.environment.name,
            query=f"{RELEASE_STAGE_ALIAS}:adopted",
        )
        assert [r["version"] for r in response.data] == [single_project_release.version]

        response = self.get_success_response(
            self.organization.slug,
            environment=self.environment.name,
            query=f"{RELEASE_STAGE_ALIAS}:adopted",
        )
        assert [r["version"] for r in response.data] == [
            single_project_release.version,
            multi_project_release.version,
        ]

    def test_query_filter(self) -> None:
        self.login_as(user=self.user)

        release = self.create_release(
            self.project,
            version="foobar",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        self.create_release(
            self.project,
            version="sdfsdfsdf",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )

        response = self.get_success_response(self.organization.slug, query="oob")
        assert [r["version"] for r in response.data] == [release.version]

        response = self.get_success_response(self.organization.slug, query="baz")
        assert [r["version"] for r in response.data] == []

        response = self.get_success_response(self.organization.slug, query="release:*oob*")
        assert [r["version"] for r in response.data] == [release.version]

        response = self.get_success_response(self.organization.slug, query="release:foob*")
        assert [r["version"] for r in response.data] == [release.version]

        response = self.get_success_response(self.organization.slug, query="release:*bar")
        assert [r["version"] for r in response.data] == [release.version]

        response = self.get_success_response(self.organization.slug, query="release:foobar")
        assert [r["version"] for r in response.data] == [release.version]

        response = self.get_success_response(self.organization.slug, query="release:*baz*")
        assert [r["version"] for r in response.data] == []


class OrganizationReleaseCreateTest(APITestCase):
    def test_empty_release_version(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        project2 = self.create_project(name="bar", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url, data={"version": "", "projects": [project.slug, project2.slug]}
        )

        assert response.status_code == 400

    def test_minimal(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        project2 = self.create_project(name="bar", organization=org, teams=[team])
        project3 = self.create_project(name="bar2", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url,
            data={"version": "1.2.1", "projects": [project.slug, project2.slug]},
            HTTP_USER_AGENT="sentry-cli/2.77.4",
        )

        assert response.status_code == 201, response.content
        assert response.data["version"]

        release = Release.objects.get(
            version=response.data["version"], user_agent="sentry-cli/2.77.4"
        )
        assert not release.owner_id
        assert release.organization == org
        assert ReleaseProject.objects.filter(release=release, project=project).exists()
        assert ReleaseProject.objects.filter(release=release, project=project2).exists()
        assert not ReleaseProject.objects.filter(release=release, project=project3).exists()

    def test_minimal_with_id(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        project2 = self.create_project(name="bar", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url,
            data={"version": "1.2.1", "projects": [project.id, project2.id]},
            HTTP_USER_AGENT="sentry-cli/2.77.4",
        )

        assert response.status_code == 201, response.content
        assert response.data["version"]

        release = Release.objects.get(
            version=response.data["version"], user_agent="sentry-cli/2.77.4"
        )
        assert not release.owner_id
        assert release.organization == org
        assert ReleaseProject.objects.filter(release=release, project=project).exists()
        assert ReleaseProject.objects.filter(release=release, project=project2).exists()

    def test_minimal_with_slug_and_id(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        project2 = self.create_project(name="bar", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url,
            data={"version": "1.2.1", "projects": [project.id, project2.slug]},
            HTTP_USER_AGENT="sentry-cli/2.77.4",
        )

        assert response.status_code == 201, response.content
        assert response.data["version"]

        release = Release.objects.get(
            version=response.data["version"], user_agent="sentry-cli/2.77.4"
        )
        assert not release.owner_id
        assert release.organization == org
        assert ReleaseProject.objects.filter(release=release, project=project).exists()
        assert ReleaseProject.objects.filter(release=release, project=project2).exists()

    def test_duplicate(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()
        repo = Repository.objects.create(
            provider="dummy", name="my-org/my-repository", organization_id=org.id
        )

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        release = Release.objects.create(version="1.2.1", organization=org)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )

        with self.tasks():
            response = self.client.post(
                url,
                data={
                    "version": "1.2.1",
                    "projects": [project.slug],
                    "refs": [
                        {
                            "repository": "my-org/my-repository",
                            "commit": "a" * 40,
                            "previousCommit": "c" * 40,
                        }
                    ],
                },
            )

        release_commits1 = list(
            ReleaseCommit.objects.filter(release=release)
            .order_by("order")
            .values_list("commit__key", flat=True)
        )

        # check that commits are overwritten
        assert release_commits1 == [
            "62de626b7c7cfb8e77efb4273b1a3df4123e6216",
            "58de626b7c7cfb8e77efb4273b1a3df4123e6345",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ]

        # should be 201 because project was added
        assert response.status_code == 201, response.content

        with self.tasks():
            with patch.object(DummyRepositoryProvider, "compare_commits") as mock_compare_commits:
                mock_compare_commits.return_value = [
                    {"id": "c" * 40, "repository": repo.name},
                    {"id": "d" * 40, "repository": repo.name},
                    {"id": "a" * 40, "repository": repo.name},
                ]
                response2 = self.client.post(
                    url,
                    data={
                        "version": "1.2.1",
                        "projects": [project.slug],
                        "refs": [
                            {
                                "repository": "my-org/my-repository",
                                "commit": "a" * 40,
                                "previousCommit": "b" * 40,
                            }
                        ],
                    },
                )

        release_commits2 = list(
            ReleaseCommit.objects.filter(release=release)
            .order_by("order")
            .values_list("commit__key", flat=True)
        )

        # check that commits are overwritten
        assert release_commits2 == [
            "cccccccccccccccccccccccccccccccccccccccc",
            "dddddddddddddddddddddddddddddddddddddddd",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ]

        assert response2.status_code == 208, response.content
        assert Release.objects.filter(version="1.2.1", organization=org).count() == 1
        # make sure project was added
        assert ReleaseProject.objects.filter(release=release, project=project).exists()

    def test_activity(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        project2 = self.create_project(name="bar", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        release = Release.objects.create(
            version="1.2.1", date_released=timezone.now(), organization=org
        )
        release.add_project(project)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.post(url, data={"version": "1.2.1", "projects": [project.slug]})
        assert response.status_code == 208, response.content

        response = self.client.post(
            url, data={"version": "1.2.1", "projects": [project.slug, project2.slug]}
        )

        # should be 201 because 1 project was added
        assert response.status_code == 201, response.content
        assert not Activity.objects.filter(
            type=ActivityType.RELEASE.value, project=project, ident=release.version
        ).exists()
        assert Activity.objects.filter(
            type=ActivityType.RELEASE.value, project=project2, ident=release.version
        ).exists()

    def test_activity_with_long_release(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        project2 = self.create_project(name="bar", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        release = Release.objects.create(
            version="x" * 65, date_released=timezone.now(), organization=org
        )
        release.add_project(project)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.post(url, data={"version": "x" * 65, "projects": [project.slug]})
        assert response.status_code == 208, response.content

        response = self.client.post(
            url, data={"version": "x" * 65, "projects": [project.slug, project2.slug]}
        )

        # should be 201 because 1 project was added
        assert response.status_code == 201, response.content
        assert not Activity.objects.filter(
            type=ActivityType.RELEASE.value, project=project, ident=release.version[:64]
        ).exists()
        assert Activity.objects.filter(
            type=ActivityType.RELEASE.value, project=project2, ident=release.version[:64]
        ).exists()

    def test_version_whitespace(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.post(url, data={"version": "1.2.3\n", "projects": [project.slug]})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "\n1.2.3", "projects": [project.slug]})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "1.\n2.3", "projects": [project.slug]})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "1.2.3\f", "projects": [project.slug]})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "1.2.3\t", "projects": [project.slug]})
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={"version": "1.2.3+dev", "projects": [project.slug]})
        assert response.status_code == 201, response.content
        assert response.data["version"] == "1.2.3+dev"

        release = Release.objects.get(organization_id=org.id, version=response.data["version"])
        assert not release.owner_id

    def test_features(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.create_member(teams=[team], user=self.user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url, data={"version": "1.2.1", "owner": self.user.email, "projects": [project.slug]}
        )

        assert response.status_code == 201, response.content
        assert response.data["version"]

        release = Release.objects.get(organization_id=org.id, version=response.data["version"])
        assert release.owner_id == self.user.id

    def test_commits(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url,
            data={
                "version": "1.2.1",
                "commits": [{"id": "a" * 40}, {"id": "b" * 40}],
                "projects": [project.slug],
            },
        )

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data["version"]

        release = Release.objects.get(organization_id=org.id, version=response.data["version"])

        rc_list = list(
            ReleaseCommit.objects.filter(release=release)
            .select_related("commit", "commit__author")
            .order_by("order")
        )
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id

    @patch("sentry.tasks.commits.fetch_commits")
    def test_commits_from_provider(self, mock_fetch_commits: MagicMock) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        repo = Repository.objects.create(
            organization_id=org.id, name="example/example", provider="dummy"
        )
        repo2 = Repository.objects.create(
            organization_id=org.id, name="example/example2", provider="dummy"
        )

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        self.client.post(
            url,
            data={
                "version": "1",
                "refs": [
                    {"commit": "0" * 40, "repository": repo.name},
                    {"commit": "0" * 40, "repository": repo2.name},
                ],
                "projects": [project.slug],
            },
        )
        response = self.client.post(
            url,
            data={
                "version": "1.2.1",
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name},
                    {"commit": "b" * 40, "repository": repo2.name},
                ],
                "projects": [project.slug],
            },
        )
        assert response.status_code == 201

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                "release_id": Release.objects.get(version="1.2.1", organization=org).id,
                "user_id": user.id,
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name},
                    {"commit": "b" * 40, "repository": repo2.name},
                ],
                "prev_release_id": Release.objects.get(version="1", organization=org).id,
            }
        )

    @patch("sentry.tasks.commits.fetch_commits")
    def test_commits_from_provider_deprecated_head_commits(
        self, mock_fetch_commits: MagicMock
    ) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        repo = Repository.objects.create(
            organization_id=org.id, name="example/example", provider="dummy"
        )
        repo2 = Repository.objects.create(
            organization_id=org.id, name="example/example2", provider="dummy"
        )

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        self.client.post(
            url,
            data={
                "version": "1",
                "headCommits": [
                    {"currentId": "0" * 40, "repository": repo.name},
                    {"currentId": "0" * 40, "repository": repo2.name},
                ],
                "projects": [project.slug],
            },
        )
        response = self.client.post(
            url,
            data={
                "version": "1.2.1",
                "headCommits": [
                    {"currentId": "a" * 40, "repository": repo.name},
                    {"currentId": "b" * 40, "repository": repo2.name},
                ],
                "projects": [project.slug],
            },
            format="json",
        )

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                "release_id": Release.objects.get(version="1.2.1", organization=org).id,
                "user_id": user.id,
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name, "previousCommit": None},
                    {"commit": "b" * 40, "repository": repo2.name, "previousCommit": None},
                ],
                "prev_release_id": Release.objects.get(version="1", organization=org).id,
            }
        )
        assert response.status_code == 201

    def test_commits_lock_conflict(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        # Simulate a concurrent request by using an existing release
        # that has its commit lock taken out.
        release = self.create_release(project, self.user, version="1.2.1")
        lock = locks.get(Release.get_lock_key(org.id, release.id), duration=10, name="release")
        lock.acquire()

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url,
            data={
                "version": release.version,
                "commits": [{"id": "a" * 40}, {"id": "b" * 40}],
                "projects": [project.slug],
            },
        )
        assert response.status_code == 409, (response.status_code, response.content)
        assert "Release commits" in response.data["detail"]

    def test_bad_project_slug(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url, data={"version": "1.2.1", "projects": [project.slug, "banana"]}
        )
        assert response.status_code == 400
        assert b"Invalid project ids or slugs" in response.content

    def test_project_permissions(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org.id,
            version="2",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release3.add_project(project1)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url, data={"version": "1.2.1", "projects": [project1.slug, project2.slug]}
        )

        assert response.status_code == 400
        assert b"Invalid project ids or slugs" in response.content

        response = self.client.post(url, data={"version": "1.2.1", "projects": [project1.slug]})

        assert response.status_code == 201, response.content

    def test_api_key(self) -> None:
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        org2 = self.create_organization()

        team1 = self.create_team(organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )

        # test right org, wrong permissions level
        with assume_test_silo_mode(SiloMode.CONTROL):
            bad_api_key = ApiKey.objects.create(organization_id=org.id, scope_list=["project:read"])
        response = self.client.post(
            url,
            data={"version": "1.2.1", "projects": [project1.slug]},
            HTTP_AUTHORIZATION=self.create_basic_auth_header(bad_api_key.key),
        )
        assert response.status_code == 403

        # test wrong org, right permissions level
        with assume_test_silo_mode(SiloMode.CONTROL):
            wrong_org_api_key = ApiKey.objects.create(
                organization_id=org2.id, scope_list=["project:write"]
            )
        response = self.client.post(
            url,
            data={"version": "1.2.1", "projects": [project1.slug]},
            HTTP_AUTHORIZATION=self.create_basic_auth_header(wrong_org_api_key.key),
        )
        assert response.status_code == 403

        # test right org, right permissions level
        with assume_test_silo_mode(SiloMode.CONTROL):
            good_api_key = ApiKey.objects.create(
                organization_id=org.id, scope_list=["project:write"]
            )
        response = self.client.post(
            url,
            data={"version": "1.2.1", "projects": [project1.slug]},
            HTTP_AUTHORIZATION=self.create_basic_auth_header(good_api_key.key),
        )
        assert response.status_code == 201, response.content

    def test_org_auth_token(self) -> None:
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        org2 = self.create_organization()

        team1 = self.create_team(organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
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
            data={"version": "1.2.1", "projects": [project1.slug]},
            HTTP_AUTHORIZATION=f"Bearer {bad_token_str}",
        )
        assert response.status_code == 403

        # test wrong org, right permissions level
        with assume_test_silo_mode(SiloMode.CONTROL):
            wrong_org_token_str = generate_token(org2.slug, "")
            OrgAuthToken.objects.create(
                organization_id=org2.id,
                name="org2 token 1",
                token_hashed=hash_token(wrong_org_token_str),
                token_last_characters="ABCD",
                scope_list=["org:ci"],
                date_last_used=None,
            )
        response = self.client.post(
            url,
            data={"version": "1.2.1", "projects": [project1.slug]},
            HTTP_AUTHORIZATION=f"Bearer {wrong_org_token_str}",
        )
        assert response.status_code == 403

        # test right org, right permissions level
        with assume_test_silo_mode(SiloMode.CONTROL):
            good_token_str = generate_token(org.slug, "")
            OrgAuthToken.objects.create(
                organization_id=org.id,
                name="token 2",
                token_hashed=hash_token(good_token_str),
                token_last_characters="ABCD",
                scope_list=["org:ci"],
                date_last_used=None,
            )

        with outbox_runner():
            response = self.client.post(
                url,
                data={"version": "1.2.1", "projects": [project1.slug]},
                HTTP_AUTHORIZATION=f"Bearer {good_token_str}",
            )
        assert response.status_code == 201, response.content

        # Make sure org token usage was updated
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_token = OrgAuthToken.objects.get(token_hashed=hash_token(good_token_str))
        assert org_token.date_last_used is not None
        assert org_token.project_last_used_id == project1.id

    @patch("sentry.tasks.commits.fetch_commits")
    def test_api_token(self, mock_fetch_commits: MagicMock) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        repo = Repository.objects.create(
            organization_id=org.id, name="getsentry/sentry", provider="dummy"
        )
        repo2 = Repository.objects.create(
            organization_id=org.id, name="getsentry/sentry-plugins", provider="dummy"
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            api_token = ApiToken.objects.create(user=user, scope_list=["project:releases"])

        team1 = self.create_team(organization=org)
        self.create_member(teams=[team1], user=user, organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.post(
            url,
            data={
                "version": "1.2.1",
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name, "previousCommit": "c" * 40},
                    {"commit": "b" * 40, "repository": repo2.name},
                ],
                "projects": [project1.slug],
            },
            HTTP_AUTHORIZATION=f"Bearer {api_token.token}",
        )

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                "release_id": Release.objects.get(version="1.2.1", organization=org).id,
                "user_id": user.id,
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name, "previousCommit": "c" * 40},
                    {"commit": "b" * 40, "repository": repo2.name},
                ],
                "prev_release_id": release1.id,
            }
        )

        assert response.status_code == 201

    def test_bad_repo_name(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.client.post(
            url,
            data={
                "version": "1.2.1",
                "projects": [project.slug],
                "refs": [{"repository": "not_a_repo", "commit": "a" * 40}],
            },
        )
        assert response.status_code == 400
        assert response.data == {"refs": ["Invalid repository names: not_a_repo"]}

    def test_project_ids_as_strings(self) -> None:
        """
        Test that project IDs can be passed as strings (common in JSON payloads).
        This ensures compatibility with clients that serialize numeric IDs as strings.
        """
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(name="test-project", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)

        # Create a token with project:releases scope
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=user, scope_list=["project:releases"])

        url = reverse(
            "sentry-api-0-organization-releases",
            kwargs={"organization_id_or_slug": org.slug},
        )

        # Test with project ID as string (common in JSON)
        response = self.client.post(
            url,
            data={"version": "1.0.0", "projects": [str(project.id)]},
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        assert response.status_code == 201, response.content
        assert Release.objects.filter(version="1.0.0", organization_id=org.id).exists()

        # Test with project ID as integer
        response = self.client.post(
            url,
            data={"version": "2.0.0", "projects": [project.id]},
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        assert response.status_code == 201, response.content
        assert Release.objects.filter(version="2.0.0", organization_id=org.id).exists()

        # Test with project slug
        response = self.client.post(
            url,
            data={"version": "3.0.0", "projects": [project.slug]},
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        assert response.status_code == 201, response.content
        assert Release.objects.filter(version="3.0.0", organization_id=org.id).exists()


class OrganizationReleaseCommitRangesTest(SetRefsTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )

    @patch("sentry.tasks.commits.fetch_commits")
    def test_simple(self, mock_fetch_commits: MagicMock) -> None:
        refs = [
            {
                "repository": "test/repo",
                "previousCommit": None,
                "commit": "previous-commit-id..current-commit-id",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-will-be-ignored",
                "commit": "previous-commit-id-2..current-commit-id-2",
            },
            {"repository": "test/repo", "commit": "previous-commit-id-3..current-commit-id-3"},
        ]

        response = self.client.post(
            self.url, data={"version": "1", "refs": refs, "projects": [self.project.slug]}
        )

        assert response.status_code == 201

        release = Release.objects.get(version="1", organization=self.org)

        commits = Commit.objects.all().order_by("id")
        self.assert_commit(commits[0], "current-commit-id")
        self.assert_commit(commits[1], "current-commit-id-2")
        self.assert_commit(commits[2], "current-commit-id-3")

        head_commits = ReleaseHeadCommit.objects.all()
        self.assert_head_commit(head_commits[0], "current-commit-id-3", release_id=release.id)

        refs_expected = [
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id",
                "commit": "current-commit-id",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id-2",
                "commit": "current-commit-id-2",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id-3",
                "commit": "current-commit-id-3",
            },
        ]
        self.assert_fetch_commits(mock_fetch_commits, None, release.id, refs_expected)

    @patch("sentry.tasks.commits.fetch_commits")
    def test_simple_with_project_id(self, mock_fetch_commits: MagicMock) -> None:
        refs = [
            {
                "repository": "test/repo",
                "previousCommit": None,
                "commit": "previous-commit-id..current-commit-id",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-will-be-ignored",
                "commit": "previous-commit-id-2..current-commit-id-2",
            },
            {"repository": "test/repo", "commit": "previous-commit-id-3..current-commit-id-3"},
        ]

        response = self.client.post(
            self.url, data={"version": "1", "refs": refs, "projects": [self.project.id]}
        )

        assert response.status_code == 201

        release = Release.objects.get(version="1", organization=self.org)

        commits = Commit.objects.all().order_by("id")
        self.assert_commit(commits[0], "current-commit-id")
        self.assert_commit(commits[1], "current-commit-id-2")
        self.assert_commit(commits[2], "current-commit-id-3")

        head_commits = ReleaseHeadCommit.objects.all()
        self.assert_head_commit(head_commits[0], "current-commit-id-3", release_id=release.id)

        refs_expected = [
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id",
                "commit": "current-commit-id",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id-2",
                "commit": "current-commit-id-2",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id-3",
                "commit": "current-commit-id-3",
            },
        ]
        self.assert_fetch_commits(mock_fetch_commits, None, release.id, refs_expected)

    @patch("sentry.tasks.commits.fetch_commits")
    def test_head_commit(self, mock_fetch_commits: MagicMock) -> None:
        headCommits = [
            {
                "currentId": "current-commit-id",
                "previousId": "previous-commit-id",
                "repository": self.repo.name,
            },
            {
                "currentId": "current-commit-id-2",
                "previousId": "previous-commit-id-2",
                "repository": self.repo.name,
            },
            {
                "currentId": "current-commit-id-3",
                "previousId": "previous-commit-id-3",
                "repository": self.repo.name,
            },
        ]

        response = self.client.post(
            self.url,
            data={"version": "1", "headCommits": headCommits, "projects": [self.project.slug]},
        )

        assert response.status_code == 201

        release = Release.objects.get(version="1", organization=self.org)

        commits = Commit.objects.all().order_by("id")
        self.assert_commit(commits[0], "current-commit-id")
        self.assert_commit(commits[1], "current-commit-id-2")
        self.assert_commit(commits[2], "current-commit-id-3")

        head_commits = ReleaseHeadCommit.objects.all()
        self.assert_head_commit(head_commits[0], "current-commit-id-3", release_id=release.id)

        refs_expected = [
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id",
                "commit": "current-commit-id",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id-2",
                "commit": "current-commit-id-2",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id-3",
                "commit": "current-commit-id-3",
            },
        ]
        self.assert_fetch_commits(mock_fetch_commits, None, release.id, refs_expected)


class OrganizationReleaseListEnvironmentsTest(APITestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org, members=[self.user])
        project1 = self.create_project(organization=org, teams=[team], name="foo")
        project2 = self.create_project(organization=org, teams=[team], name="bar")

        env1 = self.make_environment("prod", project1)
        env2 = self.make_environment("staging", project2)

        release1 = Release.objects.create(
            organization_id=org.id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release1.add_project(project1)
        ReleaseProjectEnvironment.objects.create(
            project_id=project1.id, release_id=release1.id, environment_id=env1.id
        )

        release2 = Release.objects.create(
            organization_id=org.id,
            version="2",
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release2.add_project(project2)
        ReleaseProjectEnvironment.objects.create(
            project_id=project2.id, release_id=release2.id, environment_id=env2.id
        )

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386, tzinfo=UTC),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release3.add_project(project1)
        ReleaseProjectEnvironment.objects.create(
            project_id=project1.id, release_id=release3.id, environment_id=env2.id
        )

        release4 = Release.objects.create(organization_id=org.id, version="4")
        release4.add_project(project2)

        release5 = Release.objects.create(organization_id=org.id, version="5")
        release5.add_project(project1)
        release5.add_project(project2)
        ReleaseProjectEnvironment.objects.create(
            project_id=project1.id, release_id=release5.id, environment_id=env1.id
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=project2.id, release_id=release5.id, environment_id=env2.id
        )

        self.project1 = project1
        self.project2 = project2

        self.release1 = release1
        self.release2 = release2
        self.release3 = release3
        self.release4 = release4
        self.release5 = release5

        self.env1 = env1
        self.env2 = env2
        self.org = org

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

    def test_environments_filter(self) -> None:
        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )
        response = self.client.get(url + "?environment=" + self.env1.name, format="json")
        self.assert_releases(response, [self.release1, self.release5])

        response = self.client.get(url + "?environment=" + self.env2.name, format="json")
        self.assert_releases(response, [self.release2, self.release3, self.release5])

    def test_empty_environment(self) -> None:
        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )
        env = self.make_environment("", self.project2)
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project2.id, release_id=self.release4.id, environment_id=env.id
        )
        response = self.client.get(url + "?environment=", format="json")
        self.assert_releases(response, [self.release4])

    def test_all_environments(self) -> None:
        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )
        response = self.client.get(url, format="json")
        self.assert_releases(
            response, [self.release1, self.release2, self.release3, self.release4, self.release5]
        )

    def test_invalid_environment(self) -> None:
        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )
        response = self.client.get(url + "?environment=" + "invalid_environment", format="json")
        assert response.status_code == 404

    def test_specify_project_ids(self) -> None:
        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )
        response = self.client.get(url, format="json", data={"project": self.project1.id})
        self.assert_releases(response, [self.release1, self.release3, self.release5])
        response = self.client.get(url, format="json", data={"project": self.project2.id})
        self.assert_releases(response, [self.release2, self.release4, self.release5])
        response = self.client.get(
            url, format="json", data={"project": [self.project1.id, self.project2.id]}
        )
        self.assert_releases(
            response, [self.release1, self.release2, self.release3, self.release4, self.release5]
        )

    def test_date_range(self) -> None:
        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )
        response = self.client.get(
            url,
            format="json",
            data={
                "start": (datetime.now() - timedelta(days=1)).isoformat() + "Z",
                "end": datetime.now().isoformat() + "Z",
            },
        )
        self.assert_releases(response, [self.release4, self.release5])

    def test_invalid_date_range(self) -> None:
        url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )
        response = self.client.get(url, format="json", data={"start": "null", "end": "null"})
        assert response.status_code == 400


class OrganizationReleaseCreateCommitPatch(ReleaseCommitPatchTest):
    @cached_property
    def url(self):
        return reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_id_or_slug": self.org.slug}
        )

    def test_commits_with_patch_set(self) -> None:
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
            ReleaseCommit.objects.filter(release=release)
            .select_related("commit", "commit__author")
            .order_by("order")
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


class ReleaseSerializerWithProjectsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.version = "1234567890"
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
        self.projects = ["project_slug", "project2_slug"]

    def test_simple(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={
                "version": self.version,
                "owner": self.user.username,
                "ref": self.ref,
                "url": self.url,
                "dateReleased": self.dateReleased,
                "commits": self.commits,
                "headCommits": self.headCommits,
                "refs": self.refs,
                "projects": self.projects,
            },
            context={"organization": self.organization},
        )

        assert serializer.is_valid(), serializer.errors
        assert sorted(serializer.fields.keys()) == sorted(
            [
                "version",
                "owner",
                "ref",
                "url",
                "dateReleased",
                "commits",
                "headCommits",
                "refs",
                "projects",
                "status",
            ]
        )
        result = serializer.validated_data
        assert result["version"] == self.version
        assert result["owner"]
        assert result["owner"].id == self.user.id
        assert result["owner"].username == self.user.username
        assert result["ref"] == self.ref
        assert result["url"] == self.url
        assert result["dateReleased"] == datetime(1000, 10, 10, 6, 6, tzinfo=UTC)
        assert result["commits"] == self.commits
        assert result["headCommits"] == self.headCommits
        assert result["refs"] == self.refs
        assert result["projects"] == self.projects

    def test_fields_not_required(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={"version": self.version, "projects": self.projects},
            context={"organization": self.organization},
        )
        assert serializer.is_valid()
        result = serializer.validated_data
        assert result["version"] == self.version
        assert result["projects"] == self.projects

    def test_do_not_allow_null_commits(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={"version": self.version, "projects": self.projects, "commits": None},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_do_not_allow_null_head_commits(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={"version": self.version, "projects": self.projects, "headCommits": None},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_do_not_allow_null_refs(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={"version": self.version, "projects": self.projects, "refs": None},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_ref_limited_by_max_version_length(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={
                "version": self.version,
                "projects": self.projects,
                "ref": "a" * MAX_VERSION_LENGTH,
            },
            context={"organization": self.organization},
        )
        assert serializer.is_valid()
        serializer = ReleaseSerializerWithProjects(
            data={
                "version": self.version,
                "projects": self.projects,
                "ref": "a" * (MAX_VERSION_LENGTH + 1),
            },
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_version_limited_by_max_version_length(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={"version": "a" * MAX_VERSION_LENGTH, "projects": self.projects}
        )
        assert serializer.is_valid()
        serializer = ReleaseSerializerWithProjects(
            data={"version": "a" * (MAX_VERSION_LENGTH + 1), "projects": self.projects},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_version_does_not_allow_whitespace(self) -> None:
        for char in BAD_RELEASE_CHARS:
            serializer = ReleaseSerializerWithProjects(
                data={"version": char, "projects": self.projects},
                context={"organization": self.organization},
            )
            assert not serializer.is_valid()

    def test_version_does_not_allow_current_dir_path(self) -> None:
        serializer = ReleaseSerializerWithProjects(data={"version": ".", "projects": self.projects})
        assert not serializer.is_valid()
        serializer = ReleaseSerializerWithProjects(
            data={"version": "..", "projects": self.projects},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_version_does_not_allow_null_or_empty_value(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={"version": None, "projects": self.projects},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()
        serializer = ReleaseSerializerWithProjects(
            data={"version": "", "projects": self.projects},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()

    def test_version_cannot_be_latest(self) -> None:
        serializer = ReleaseSerializerWithProjects(
            data={"version": "Latest", "projects": self.projects},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()


class ReleaseHeadCommitSerializerTest(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo_name = "repo/name"
        self.commit = "b" * 40
        self.commit_range = "{}..{}".format("a" * 40, "b" * 40)
        self.prev_commit = "a" * 40

    def test_simple(self) -> None:
        serializer = ReleaseHeadCommitSerializer(
            data={
                "commit": self.commit,
                "previousCommit": self.prev_commit,
                "repository": self.repo_name,
            }
        )

        assert serializer.is_valid()
        assert sorted(serializer.fields.keys()) == sorted(
            ["commit", "previousCommit", "repository"]
        )
        result = serializer.validated_data
        assert result["commit"] == self.commit
        assert result["previousCommit"] == self.prev_commit
        assert result["repository"] == self.repo_name

    def test_prev_commit_not_required(self) -> None:
        serializer = ReleaseHeadCommitSerializer(
            data={"commit": self.commit, "previousCommit": None, "repository": self.repo_name}
        )
        assert serializer.is_valid()

    def test_do_not_allow_null_or_empty_commit_or_repo(self) -> None:
        serializer = ReleaseHeadCommitSerializer(
            data={"commit": None, "previousCommit": self.prev_commit, "repository": self.repo_name}
        )
        assert not serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={"commit": "", "previousCommit": self.prev_commit, "repository": self.repo_name}
        )
        assert not serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={"commit": self.commit, "previousCommit": self.prev_commit, "repository": None}
        )
        assert not serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={"commit": self.commit, "previousCommit": self.prev_commit, "repository": ""}
        )
        assert not serializer.is_valid()

    def test_single_commit_limited_by_max_commit_length(self) -> None:
        serializer = ReleaseHeadCommitSerializer(
            data={"commit": "b" * MAX_COMMIT_LENGTH, "repository": self.repo_name}
        )
        assert serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={
                "commit": self.commit,
                "previousCommit": "a" * MAX_COMMIT_LENGTH,
                "repository": self.repo_name,
            }
        )
        assert serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={"commit": "b" * (MAX_COMMIT_LENGTH + 1), "repository": self.repo_name}
        )
        assert not serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={
                "commit": self.commit,
                "previousCommit": "a" * (MAX_COMMIT_LENGTH + 1),
                "repository": self.repo_name,
            }
        )
        assert not serializer.is_valid()

    def test_commit_range_does_not_allow_empty_commits(self) -> None:
        serializer = ReleaseHeadCommitSerializer(
            data={
                "commit": "{}..{}".format("", "b" * MAX_COMMIT_LENGTH),
                "repository": self.repo_name,
            }
        )
        assert not serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={
                "commit": "{}..{}".format("a" * MAX_COMMIT_LENGTH, ""),
                "repository": self.repo_name,
            }
        )
        assert not serializer.is_valid()

    def test_commit_range_limited_by_max_commit_length(self) -> None:
        serializer = ReleaseHeadCommitSerializer(
            data={
                "commit": "{}..{}".format("a" * MAX_COMMIT_LENGTH, "b" * MAX_COMMIT_LENGTH),
                "repository": self.repo_name,
            }
        )
        assert serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={
                "commit": "{}..{}".format("a" * (MAX_COMMIT_LENGTH + 1), "b" * MAX_COMMIT_LENGTH),
                "repository": self.repo_name,
            }
        )
        assert not serializer.is_valid()
        serializer = ReleaseHeadCommitSerializer(
            data={
                "commit": "{}..{}".format("a" * MAX_COMMIT_LENGTH, "b" * (MAX_COMMIT_LENGTH + 1)),
                "repository": self.repo_name,
            }
        )
        assert not serializer.is_valid()
