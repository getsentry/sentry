from datetime import datetime, timedelta, timezone

from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
from sentry.api.endpoints.release_thresholds.utils import get_new_issue_counts
from sentry.api.serializers import serialize
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import TestCase


class GetNewIssueCountTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project1 = self.create_project(name="foo", organization=self.org)
        self.project2 = self.create_project(name="bar", organization=self.org)

        # 2 environments
        self.null_environment = Environment.objects.create(
            organization_id=self.organization.id, name=""
        )
        self.canary_environment = Environment.objects.create(
            organization_id=self.organization.id, name="canary"
        )

        # release created for proj1, and proj2
        self.release1 = Release.objects.create(version="v1", organization=self.organization)
        # add_project get_or_creates a ReleaseProject
        self.release1.add_project(self.project1)
        self.release1.add_project(self.project2)

        # Attaches the release to a particular environment
        # project superfluous/deprecated in ReleaseEnvironment
        # release1 canary
        ReleaseEnvironment.objects.create(
            organization_id=self.organization.id,
            release_id=self.release1.id,
            environment_id=self.canary_environment.id,
        )
        # Release Project Environments are required to query releases by project
        # Even though both environment & project are here, this seems to just attach a release to a project
        # You can have multiple ReleaseProjectEnvironment's per release (this attaches multiple projects to the release&env)
        # release1 project1 canary
        ReleaseProjectEnvironment.objects.create(
            release_id=self.release1.id,
            project_id=self.project1.id,
            environment_id=self.canary_environment.id,
        )

        self.now = datetime.now(timezone.utc)

        self.group1_p1_r1 = Group.objects.create(
            project=self.project1,
            first_release=self.release1,
            first_seen=self.now - timedelta(minutes=30),
        )
        self.groupenvironment_g1_r1 = GroupEnvironment.objects.create(
            group_id=self.group1_p1_r1.id,
            environment_id=self.null_environment.id,
            first_release=self.release1,
            first_seen=self.now - timedelta(minutes=30),
        )
        self.group2_p1_r1 = Group.objects.create(
            project=self.project1,
            first_release=self.release1,
            first_seen=self.now - timedelta(minutes=30),
        )
        self.groupenvironment_g2_r1 = GroupEnvironment.objects.create(
            group_id=self.group2_p1_r1.id,
            environment_id=self.canary_environment.id,
            first_release=self.release1,
            first_seen=self.now - timedelta(minutes=30),
        )

    def test_success_fetches_new_issue_counts(self):
        # standard threshold
        t1: EnrichedThreshold = {
            "id": "1",
            "project_id": self.project1.id,
            "release": self.release1.version,
            "start": self.now - timedelta(hours=1),
            "end": self.now,
            "date": self.now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_slug": self.project1.slug,
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        # threshold w/ environment
        t2: EnrichedThreshold = {
            "id": "2",
            "project_id": self.project1.id,
            "release": self.release1.version,
            "start": self.now - timedelta(hours=1),
            "end": self.now,
            "date": self.now,
            "environment": {"name": "canary"},
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_slug": self.project1.slug,
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        # second threshold separate start/end
        t3: EnrichedThreshold = {
            "id": "3",
            "project_id": self.project1.id,
            "release": self.release1.version,
            "start": self.now,
            "end": self.now + timedelta(hours=1),
            "date": self.now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_slug": self.project1.slug,
            "threshold_type": ReleaseThresholdType.NEW_ISSUE_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        thresholds: list[EnrichedThreshold] = [t1, t2, t3]
        new_issue_counts = get_new_issue_counts(organization_id=self.org.id, thresholds=thresholds)

        assert new_issue_counts[str(t1["id"])] == 1
        assert new_issue_counts[str(t2["id"])] == 1
        assert new_issue_counts.get(str(t3["id"]), None) is None
