import datetime
from datetime import timedelta
from functools import cached_property
from unittest import mock

from django.conf import settings
from django.db.models import F
from django.utils import timezone

from sentry import features
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import (
    DetailedProjectSerializer,
    ProjectSummarySerializer,
    ProjectWithOrganizationSerializer,
    ProjectWithTeamSerializer,
    bulk_fetch_project_latest_releases,
)
from sentry.app import env
from sentry.features.base import ProjectFeature
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.userreport import UserReport
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data

TEAM_CONTRIBUTOR = settings.SENTRY_TEAM_ROLES[0]
TEAM_ADMIN = settings.SENTRY_TEAM_ROLES[1]


@region_silo_test
@apply_feature_flag_on_cls("organizations:cleanup-project-serializer")
class ProjectSerializerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[self.team], organization=self.organization)

    def test_simple(self):
        result = serialize(self.project, self.user)
        assert result["slug"] == self.project.slug
        assert result["name"] == self.project.name
        assert result["id"] == str(self.project.id)

    def test_member(self):
        self.create_member(user=self.user, organization=self.organization)

        result = serialize(self.project, self.user)
        assert result["access"] == TEAM_CONTRIBUTOR["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["access"] == set()
        assert result["hasAccess"] is False
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["access"] == TEAM_CONTRIBUTOR["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    @with_feature("organizations:team-roles")
    def test_member_with_team_role(self):
        self.create_member(user=self.user, organization=self.organization)

        result = serialize(self.project, self.user)
        assert result["access"] == TEAM_CONTRIBUTOR["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["access"] == set()
        assert result["hasAccess"] is False
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team, role="admin")
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    def test_admin(self):
        self.create_member(user=self.user, organization=self.organization, role="admin")

        result = serialize(self.project, self.user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["access"] == set()
        assert result["hasAccess"] is False
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    def test_manager(self):
        self.create_member(user=self.user, organization=self.organization, role="manager")

        result = serialize(self.project, self.user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    def test_owner(self):
        self.create_member(user=self.user, organization=self.organization, role="owner")

        result = serialize(self.project, self.user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    def test_superuser(self):
        self.user = self.create_user(username="foo", is_superuser=True)
        req = self.make_request()
        req.user = self.user
        req.superuser.set_logged_in(req.user)

        with mock.patch.object(env, "request", req):
            result = serialize(self.project, self.user)
            assert result["access"] == TEAM_ADMIN["scopes"]
            assert result["hasAccess"] is True
            assert result["isMember"] is False

            self.organization.flags.allow_joinleave = False
            self.organization.save()
            result = serialize(self.project, self.user)
            # after changing to allow_joinleave=False
            assert result["access"] == TEAM_ADMIN["scopes"]
            assert result["hasAccess"] is True
            assert result["isMember"] is False

    def test_member_on_owner_team(self):
        organization = self.create_organization()
        manager_team = self.create_team(organization=organization, org_role="manager")
        owner_team = self.create_team(organization=organization, org_role="owner")
        self.create_member(
            user=self.user,
            organization=self.organization,
            role="member",
            teams=[manager_team, owner_team],
        )

        result = serialize(self.project, self.user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        result = serialize(self.project, self.user)
        # after changing to allow_joinleave=False
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.create_team_membership(user=self.user, team=self.team)
        result = serialize(self.project, self.user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    @mock.patch("sentry.features.batch_has")
    def test_project_batch_has(self, mock_batch):
        mock_batch.return_value = {
            f"project:{self.project.id}": {
                "projects:test-feature": True,
                "projects:disabled-feature": False,
            }
        }
        result = serialize(self.project, self.user)
        assert "test-feature" in result["features"]
        assert "disabled-feature" not in result["features"]

    @mock.patch("sentry.api.serializers.project.features")
    def test_project_features(self, mock_features):
        test_features = features.FeatureManager()
        mock_features.all = test_features.all
        mock_features.has = test_features.has
        mock_features.batch_has = test_features.batch_has
        mock_features.has_for_batch = test_features.has_for_batch

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

            def batch_has(self, *a, **k):
                raise NotImplementedError("unreachable")

        def create_color_handler(color_flag, included_projects):
            class ProjectColorFeatureHandler(features.FeatureHandler):
                features = {color_flag}

                def has(self, feature, actor):
                    return feature.project in included_projects

                def batch_has(self, *a, **k):
                    raise NotImplementedError("unreachable")

            return ProjectColorFeatureHandler()

        test_features.add(early_flag, ProjectFeature)
        test_features.add(red_flag, ProjectFeature)
        test_features.add(blue_flag, ProjectFeature)
        red_handler = create_color_handler(red_flag, [early_red, late_red])
        blue_handler = create_color_handler(blue_flag, [early_blue, late_blue])
        for handler in (EarlyAdopterFeatureHandler(), red_handler, blue_handler):
            test_features.add_handler(handler)

        def api_form(flag):
            return flag[len("projects:") :]

        flags_to_find = {api_form(f) for f in [early_flag, red_flag, blue_flag]}

        def assert_has_features(project, expected_features):
            serialized = serialize(project)
            actual_features = {f for f in serialized["features"] if f in flags_to_find}
            assert actual_features == {api_form(f) for f in expected_features}

        assert_has_features(early_red, [early_flag, red_flag])
        assert_has_features(early_blue, [early_flag, blue_flag])
        assert_has_features(late_red, [red_flag])
        assert_has_features(late_blue, [blue_flag])


@region_silo_test
@apply_feature_flag_on_cls("organizations:cleanup-project-serializer")
class ProjectWithTeamSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username="foo")
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name="foo")

        result = serialize(project, user, ProjectWithTeamSerializer())

        assert result["slug"] == project.slug
        assert result["name"] == project.name
        assert result["id"] == str(project.id)
        assert result["team"] == {
            "id": str(team.id),
            "slug": team.slug,
            "name": team.name,
        }


@region_silo_test
@apply_feature_flag_on_cls("organizations:cleanup-project-serializer")
class ProjectSummarySerializerTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()
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

        assert result["id"] == str(self.project.id)
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
            project_id=self.project.id,
            event_id="1",
            name="foo",
            email="bar@example.com",
            comments="It broke!",
        )
        UserReport.objects.create(
            project_id=self.project.id,
            event_id="2",
            name="foo",
            email="bar@example.com",
            comments="It broke again!",
        )

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasUserReports"] is True

    def test_has_sessions_flag(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasSessions"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_sessions))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasSessions"] is True

    def test_has_profiles_flag(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasProfiles"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_profiles))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasProfiles"] is True

    def test_has_replays_flag(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasReplays"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_replays))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasReplays"] is True

    def test_has_feedbacks_flag(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasFeedbacks"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_feedbacks))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasFeedbacks"] is True

    def test_has_new_feedbacks_flag(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasNewFeedbacks"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_new_feedbacks))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasNewFeedbacks"] is True

    def test_has_custom_metrics_flag(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasCustomMetrics"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_custom_metrics))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasCustomMetrics"] is True

    def test_has_monitors_flag(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasMonitors"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_cron_monitors))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasMonitors"] is True

    def test_has_minified_stracktrace_flag(self):
        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasMinifiedStackTrace"] is False

        self.project.first_event = timezone.now()
        self.project.update(flags=F("flags").bitor(Project.flags.has_minified_stack_trace))

        result = serialize(self.project, self.user, ProjectSummarySerializer())
        assert result["hasMinifiedStackTrace"] is True

    def test_no_environments(self):
        # remove environments and related models
        Deploy.objects.all().delete()
        Release.objects.all().delete()
        Environment.objects.all().delete()

        result = serialize(self.project, self.user, ProjectSummarySerializer())

        assert result["id"] == str(self.project.id)
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

        assert result["id"] == str(self.project.id)
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
        assert result[0]["id"] == str(self.project.id)
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
        assert result[1]["id"] == str(other_project.id)
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
        serializer = ProjectSummarySerializer(stats_period="24h", expand=["transaction_stats"])
        results = serialize([self.project], self.user, serializer)
        assert "stats" in results[0]
        assert 24 == len(results[0]["stats"])

        assert [1] == [v[1] for v in results[0]["stats"] if v[1] > 0]

        assert "transactionStats" in results[0]
        assert 24 == len(results[0]["transactionStats"])
        assert [1] == [v[1] for v in results[0]["transactionStats"] if v[1] > 0]

    @mock.patch(
        "sentry.api.serializers.models.project.release_health.backend.check_has_health_data"
    )
    @mock.patch(
        "sentry.api.serializers.models.project.release_health.backend.get_current_and_previous_crash_free_rates"
    )
    def test_stats_with_sessions(
        self, get_current_and_previous_crash_free_rates, check_has_health_data
    ):
        get_current_and_previous_crash_free_rates.return_value = {
            self.project.id: {
                "currentCrashFreeRate": 75.63453,
                "previousCrashFreeRate": 99.324543,
            }
        }
        serializer = ProjectSummarySerializer(stats_period="24h", expand=["session_stats"])
        results = serialize([self.project], self.user, serializer)

        assert "sessionStats" in results[0]
        assert results[0]["sessionStats"]["previousCrashFreeRate"] == 99.324543
        assert results[0]["sessionStats"]["currentCrashFreeRate"] == 75.63453
        assert results[0]["sessionStats"]["hasHealthData"]

        assert check_has_health_data.call_count == 0

    @mock.patch(
        "sentry.api.serializers.models.project.release_health.backend.check_has_health_data"
    )
    @mock.patch(
        "sentry.api.serializers.models.project.release_health.backend.get_current_and_previous_crash_free_rates"
    )
    def test_stats_with_sessions_and_none_crash_free_rates(
        self, get_current_and_previous_crash_free_rates, check_has_health_data
    ):
        """
        Test that ensures if both `currentCrashFreeRate` and `previousCrashFreeRate` are None, then
        we need to make a call to `check_has_health_data` to know if we have health data in that
        specific project_id(s)
        """
        check_has_health_data.return_value = {self.project.id}
        get_current_and_previous_crash_free_rates.return_value = {
            self.project.id: {
                "currentCrashFreeRate": None,
                "previousCrashFreeRate": None,
            }
        }
        serializer = ProjectSummarySerializer(stats_period="24h", expand=["session_stats"])
        results = serialize([self.project], self.user, serializer)

        assert "sessionStats" in results[0]
        assert results[0]["sessionStats"]["previousCrashFreeRate"] is None
        assert results[0]["sessionStats"]["currentCrashFreeRate"] is None
        assert results[0]["sessionStats"]["hasHealthData"]

        assert check_has_health_data.call_count == 1


@region_silo_test
@apply_feature_flag_on_cls("organizations:cleanup-project-serializer")
class ProjectWithOrganizationSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username="foo")
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name="foo")

        result = serialize(project, user, ProjectWithOrganizationSerializer())

        assert result["slug"] == project.slug
        assert result["name"] == project.name
        assert result["id"] == str(project.id)
        assert result["organization"] == serialize(organization, user)


@region_silo_test
@apply_feature_flag_on_cls("organizations:cleanup-project-serializer")
class DetailedProjectSerializerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.date = datetime.datetime(2018, 1, 12, 3, 8, 25, tzinfo=timezone.utc)
        self.user = self.create_user(username="foo")
        self.organization = self.create_organization(owner=self.user)
        team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[team], organization=self.organization, name="foo")
        self.project.flags.has_releases = True
        self.project.save()

        self.release = self.create_release(self.project)

    def test_truncated_latest_release(self):
        result = serialize(self.project, self.user, DetailedProjectSerializer())

        assert result["id"] == str(self.project.id)
        assert result["name"] == self.project.name
        assert result["slug"] == self.project.slug
        assert result["firstEvent"] == self.project.first_event
        assert "releases" in result["features"]
        assert result["platform"] == self.project.platform
        assert result["latestRelease"] == {"version": self.release.version}

    def test_symbol_sources(self):
        ProjectOption.objects.set_value(
            project=self.project,
            key="sentry:symbol_sources",
            value='[{"id":"1","name":"hello","password":"password",}]',
        )
        result = serialize(self.project, self.user, DetailedProjectSerializer())

        assert "sentry:token" not in result["options"]
        assert "sentry:symbol_sources" not in result["options"]


@region_silo_test
@apply_feature_flag_on_cls("organizations:cleanup-project-serializer")
class BulkFetchProjectLatestReleases(TestCase):
    @cached_property
    def project(self):
        return self.create_project(teams=[self.team], organization=self.organization)

    @cached_property
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
        assert set(bulk_fetch_project_latest_releases([self.project, self.other_project])) == {
            release
        }

    def test_multi_releases(self):
        release = self.create_release(
            self.project, date_added=timezone.now() - timedelta(minutes=5)
        )
        other_project_release = self.create_release(self.other_project)
        assert set(bulk_fetch_project_latest_releases([self.project, self.other_project])) == {
            release,
            other_project_release,
        }
        release_2 = self.create_release(self.project)
        assert set(bulk_fetch_project_latest_releases([self.project, self.other_project])) == {
            release_2,
            other_project_release,
        }
