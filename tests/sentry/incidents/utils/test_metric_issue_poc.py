from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.utils.metric_issue_poc import create_or_update_metric_issue
from sentry.issues.grouptype import MetricIssuePOC
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group, GroupStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.actor import Actor
from sentry.types.group import GroupSubStatus, PriorityLevel
from tests.sentry.issues.test_occurrence_consumer import IssueOccurrenceTestBase


@apply_feature_flag_on_cls("organizations:metric-issue-poc-ingest")
@apply_feature_flag_on_cls("projects:metric-issue-creation")
class TestMetricIssuePOC(IssueOccurrenceTestBase, APITestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

        self.user = self.create_user()
        self.member = self.create_member(user=self.user, organization=self.organization)
        self.team = self.create_team(organization=self.organization, members=[self.user])
        self.actor = Actor.from_identifier(self.user.id)

        self.alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            name="My Alert Rule",
            owner=self.actor,
        )

        self.incident = self.create_incident(
            organization=self.organization,
            projects=[self.project],
            alert_rule=self.alert_rule,
            title="My Incident",
            status=IncidentStatus.CRITICAL.value,
        )

        self.event_data = {
            "project_id": self.project.id,
            "timestamp": self.incident.date_started.isoformat(),
            "platform": self.project.platform or "",
            "received": self.incident.date_started.isoformat(),
        }

    @django_db_all
    def test_incident_creates_metric_issue(self):
        occurrence = create_or_update_metric_issue(self.incident, 100.0)
        assert occurrence
        occurrence.save()

        self.event_data["event_id"] = occurrence.event_id
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        assert occurrence.event_id == stored_occurrence.event_id
        assert occurrence.type == MetricIssuePOC
        assert occurrence.initial_issue_priority == PriorityLevel.HIGH

        assert Group.objects.filter(type=MetricIssuePOC.type_id).count() == 1
        group = Group.objects.get(type=MetricIssuePOC.type_id)

        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.NEW
        assert group.priority == PriorityLevel.HIGH
        assignee = group.get_assignee()
        assert assignee is not None
        assert Actor.from_identifier(assignee.id) == self.alert_rule.owner

    @django_db_all
    def test_resolved_incident(self):
        assert Group.objects.filter(type=MetricIssuePOC.type_id).count() == 0
        self.incident.status = IncidentStatus.CLOSED.value
        occurrence = create_or_update_metric_issue(self.incident, 0.0)
        assert occurrence
        occurrence.save()
        self.event_data["event_id"] = occurrence.event_id

        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        assert stored_occurrence.type == MetricIssuePOC
        assert stored_occurrence.initial_issue_priority == PriorityLevel.MEDIUM

        assert Group.objects.filter(type=MetricIssuePOC.type_id).count() == 1
        group = Group.objects.get(type=MetricIssuePOC.type_id)

        assert group.status == GroupStatus.RESOLVED
        assert group.substatus is None
        assert group.priority == PriorityLevel.MEDIUM
