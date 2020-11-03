# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta

import six
import datetime
from django.db.models import F
from django.utils import timezone
from exam import fixture

from sentry import features
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import (
    bulk_fetch_project_latest_releases,
    ProjectWithOrganizationSerializer,
    ProjectWithTeamSerializer,
    ProjectSummarySerializer,
)
from sentry.models import (
    Deploy,
    Environment,
    EnvironmentProject,
    Project,
    Release,
    ReleaseProjectEnvironment,
    UserReport,
)
from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data
from sentry.utils.compat import mock


class ProjectSerializerTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[self.team], organization=self.organization)

    def test_simple(self):
        result = serialize(self.project, self.user)

        assert result["slug"] == self.project.slug
        assert result["name"] == self.project.name
        assert result["id"] == six.text_type(self.project.id)

    def test_member_access(self):
        self.create_member(user=self.user, organization=self.organization)

        result = serialize(self.project, self.user)

        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is False
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    def test_admin_access(self):
        self.create_member(user=self.user, organization=self.organization, role="admin")

        result = serialize(self.project, self.user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is False
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    def test_manager_access(self):
        self.create_member(user=self.user, organization=self.organization, role="manager")

        result = serialize(self.project, self.user)

        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    def test_owner_access(self):
        self.create_member(user=self.user, organization=self.organization, role="owner")

        result = serialize(self.project, self.user)

        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    @mock.patch("sentry.features.batch_has")
    def test_project_batch_has(self, mock_batch):
        mock_batch.return_value = {
            "project:{}".format(self.project.id): {
                "projects:test-feature": True,
                "projects:disabled-feature": False,
            }
        }
        result = serialize(self.project, self.user)
        assert "test-feature" in result["features"]
        assert "disabled-feature" not in result["features"]

    def test_project_features(self):
        early_flag = "projects:TEST_early"
        red_flag = "projects:TEST_red"
        blue_flag = "projects:TEST_blue"

        early_adopter = self.create_organization()
        early_red = self.create_project(organization=early_adopter)
        early_blue = self.create_project(organization=early_adopter)

        late_adopter = self.create_organization()
        late_red = self.create_project(organization=late_adopter)
        late_blue = self.create_project(organization=late_adopter)

        class EarlyAdopterFeatureHandler(features.BatchFeatureHandler):
            features = {early_flag}

            def _check_for_batch(self, feature_name, organization, actor):
                return organization == early_adopter

        def create_color_handler(color_flag, included_projects):
            class ProjectColorFeatureHandler(features.FeatureHandler):
                features = {color_flag}

                def has(self, feature, actor):
                    return feature.project in included_projects

            return ProjectColorFeatureHandler()

        features.add(early_flag, features.ProjectFeature)
        features.add(red_flag, features.ProjectFeature)
        features.add(blue_flag, features.ProjectFeature)
        red_handler = create_color_handler(red_flag, [early_red, late_red])
        blue_handler = create_color_handler(blue_flag, [early_blue, late_blue])
        for handler in (EarlyAdopterFeatureHandler(), red_handler, blue_handler):
            features.add_handler(handler)

        def api_form(flag):
            return flag[len("projects:") :]

        flags_to_find = set(api_form(f) for f in [early_flag, red_flag, blue_flag])

        def assert_has_features(project, expected_features):
            serialized = serialize(project)
            actual_features = set(f for f in serialized["features"] if f in flags_to_find)
            assert actual_features == set(api_form(f) for f in expected_features)

        assert_has_features(early_red, [early_flag, red_flag])
        assert_has_features(early_blue, [early_flag, blue_flag])
        assert_has_features(late_red, [red_flag])
        assert_has_features(late_blue, [blue_flag])


class ProjectWithTeamSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username="foo")
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name="foo")

        result = serialize(project, user, ProjectWithTeamSerializer())

        assert result["slug"] == project.slug
        assert result["name"] == project.name
        assert result["id"] == six.text_type(project.id)
        assert result["team"] == {
            "id": six.text_type(team.id),
            "slug": team.slug,
            "name": team.name,
        }


class ProjectSummarySerializerTest(SnubaTestCase, TestCase):
    def setUp(self):
        super(ProjectSummarySerializerTest, self).setUp()
        self.date = datetime.datetime(2018, 1, 12, 3, 8, 25, tzinfo=timezone.utc)
        self.user = self.create_user(username="foo")
        self.organization = self.create_organization(owner=self.user)
        team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[team], organization=self.organization, name="foo")
        self.project.flags.has_releases = True
        self.project.save()

        self.release = self.create_release(self.project)

        self.environment_1 = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        self.environment_1.add_project(self.project)
        self.environment_1.save()
        self.environment_2 = Environment.objects.create(
            organization_id=self.organization.id, name="staging"
        )
        self.environment_2.add_project(self.project)
        self.environment_2.save()
        deploy = Deploy.objects.create(
            environment_id=self.environment_1.id,
            organization_id=self.organization.id,
            release=self.release,
            date_finished=self.date,
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=self.release.id,
            environment_id=self.environment_1.id,
            last_deploy_id=deploy.id,
        )

    def test_simple(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())

        assert result["id"] == six.text_type(self.project.id)
        assert result["name"] == self.project.name
        assert result["slug"] == self.project.slug
        assert result["firstEvent"] == self.project.first_event
        assert "releases" in result["features"]
        assert result["platform"] == self.project.platform

        assert result["latestDeploys"] == {
            "production": {"dateFinished": self.date, "version": self.release.version}
        }
        assert result["latestRelease"] == {"version": self.release.version}
        assert result["environments"] == ["production", "staging"]

    def test_first_event_properties(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["firstEvent"] is None
        assert result["firstTransactionEvent"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["firstEvent"]
        assert result["firstTransactionEvent"] is True

    def test_user_reports(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasUserReports"] is False

        UserReport.objects.create(
            project=self.project,
            event_id="1",
            name="foo",
            email="bar@example.com",
            comments="It broke!",
        )
        UserReport.objects.create(
            project=self.project,
            event_id="2",
            name="foo",
            email="bar@example.com",
            comments="It broke again!",
        )

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasUserReports"] is True

    def test_no_environments(self):
        # remove environments and related models
        Deploy.objects.all().delete()
        Release.objects.all().delete()
        Environment.objects.all().delete()

        result = serialize(self.project, self.user, ProjectSummarySerializer())

        assert result["id"] == six.text_type(self.project.id)
        assert result["name"] == self.project.name
        assert result["slug"] == self.project.slug
        assert result["firstEvent"] == self.project.first_event
        assert "releases" in result["features"]
        assert result["platform"] == self.project.platform

        assert result["latestDeploys"] is None
        assert result["latestRelease"] is None
        assert result["environments"] == []

    def test_avoid_hidden_and_no_env(self):
        hidden_env = Environment.objects.create(
            organization_id=self.organization.id, name="staging 2"
        )
        EnvironmentProject.objects.create(
            project=self.project, environment=hidden_env, is_hidden=True
        )

        no_env = Environment.objects.create(organization_id=self.organization.id, name="")
        no_env.add_project(self.project)
        no_env.save()

        result = serialize(self.project, self.user, ProjectSummarySerializer())

        assert result["id"] == six.text_type(self.project.id)
        assert result["name"] == self.project.name
        assert result["slug"] == self.project.slug
        assert result["firstEvent"] == self.project.first_event
        assert "releases" in result["features"]
        assert result["platform"] == self.project.platform

        assert result["latestDeploys"] == {
            "production": {"dateFinished": self.date, "version": self.release.version}
        }
        assert result["latestRelease"] == {"version": self.release.version}
        assert result["environments"] == ["production", "staging"]

    def test_multiple_environments_deploys(self):
        env_1_release = self.create_release(self.project)
        env_1_deploy = Deploy.objects.create(
            environment_id=self.environment_1.id,
            organization_id=self.organization.id,
            release=env_1_release,
            date_finished=self.date + timedelta(minutes=20),
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=env_1_release.id,
            environment_id=self.environment_1.id,
            last_deploy_id=env_1_deploy.id,
        )

        env_2_release = self.create_release(self.project)
        Deploy.objects.create(
            environment_id=self.environment_2.id,
            organization_id=self.organization.id,
            release=env_2_release,
            date_finished=self.date - timedelta(days=5),
        )
        env_2_deploy = Deploy.objects.create(
            environment_id=self.environment_2.id,
            organization_id=self.organization.id,
            release=env_2_release,
            date_finished=self.date,
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=env_2_release.id,
            environment_id=self.environment_2.id,
            last_deploy_id=env_2_deploy.id,
        )
        other_project = self.create_project()
        other_project_release = self.create_release(other_project)
        other_project_deploy = Deploy.objects.create(
            environment_id=self.environment_2.id,
            organization_id=self.organization.id,
            release=other_project_release,
            date_finished=self.date - timedelta(minutes=350),
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=other_project.id,
            release_id=other_project_release.id,
            environment_id=self.environment_2.id,
            last_deploy_id=other_project_deploy.id,
        )
        result = serialize([self.project, other_project], self.user, ProjectSummarySerializer())
        assert result[0]["id"] == six.text_type(self.project.id)
        assert result[0]["latestDeploys"] == {
            self.environment_1.name: {
                "version": env_1_release.version,
                "dateFinished": env_1_deploy.date_finished,
            },
            self.environment_2.name: {
                "version": env_2_release.version,
                "dateFinished": env_2_deploy.date_finished,
            },
        }
        assert result[1]["id"] == six.text_type(other_project.id)
        assert result[1]["latestDeploys"] == {
            self.environment_2.name: {
                "version": other_project_release.version,
                "dateFinished": other_project_deploy.date_finished,
            }
        }

    def test_stats_errors(self):
        two_min_ago = before_now(minutes=2)
        self.store_event(
            data={"event_id": "d" * 32, "message": "oh no", "timestamp": iso_format(two_min_ago)},
            project_id=self.project.id,
        )
        serializer = ProjectSummarySerializer(stats_period="24h")
        results = serialize([self.project], self.user, serializer)
        assert "stats" in results[0]
        assert 24 == len(results[0]["stats"])
        assert [1] == [v[1] for v in results[0]["stats"] if v[1] > 0]

    def test_stats_with_transactions(self):
        two_min_ago = before_now(minutes=2)
        self.store_event(
            data={"event_id": "d" * 32, "message": "oh no", "timestamp": iso_format(two_min_ago)},
            project_id=self.project.id,
        )
        transaction = load_data("transaction", timestamp=two_min_ago)
        self.store_event(data=transaction, project_id=self.project.id)
        serializer = ProjectSummarySerializer(stats_period="24h", transaction_stats=True)
        results = serialize([self.project], self.user, serializer)
        assert "stats" in results[0]
        assert 24 == len(results[0]["stats"])

        assert [1] == [v[1] for v in results[0]["stats"] if v[1] > 0]

        assert "transactionStats" in results[0]
        assert 24 == len(results[0]["transactionStats"])
        assert [1] == [v[1] for v in results[0]["transactionStats"] if v[1] > 0]


class ProjectWithOrganizationSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username="foo")
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name="foo")

        result = serialize(project, user, ProjectWithOrganizationSerializer())

        assert result["slug"] == project.slug
        assert result["name"] == project.name
        assert result["id"] == six.text_type(project.id)
        assert result["organization"] == serialize(organization, user)


class BulkFetchProjectLatestReleases(TestCase):
    @fixture
    def project(self):
        return self.create_project(teams=[self.team], organization=self.organization)

    @fixture
    def other_project(self):
        return self.create_project(teams=[self.team], organization=self.organization)

    def test_single_no_release(self):
        assert bulk_fetch_project_latest_releases([self.project]) == []

    def test_single_release(self):
        release = self.create_release(
            self.project, date_added=timezone.now() - timedelta(minutes=5)
        )
        assert bulk_fetch_project_latest_releases([self.project]) == [release]
        newer_release = self.create_release(self.project)
        assert bulk_fetch_project_latest_releases([self.project]) == [newer_release]

    def test_multi_no_release(self):
        assert bulk_fetch_project_latest_releases([self.project, self.other_project]) == []

    def test_multi_mixed_releases(self):
        release = self.create_release(self.project)
        assert set(bulk_fetch_project_latest_releases([self.project, self.other_project])) == set(
            [release]
        )

    def test_multi_releases(self):
        release = self.create_release(
            self.project, date_added=timezone.now() - timedelta(minutes=5)
        )
        other_project_release = self.create_release(self.other_project)
        assert set(bulk_fetch_project_latest_releases([self.project, self.other_project])) == set(
            [release, other_project_release]
        )
        release_2 = self.create_release(self.project)
        assert set(bulk_fetch_project_latest_releases([self.project, self.other_project])) == set(
            [release_2, other_project_release]
        )
