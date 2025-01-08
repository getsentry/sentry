import datetime
import uuid
from hashlib import md5
from itertools import cycle
from unittest.mock import patch

from sentry.issues.grouptype import UptimeDomainCheckFailure
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType
from sentry.models.group import Group, GroupStatus
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.issue_platform import (
    build_event_data_for_occurrence,
    build_occurrence_from_result,
    create_issue_platform_occurrence,
    resolve_uptime_issue,
)


@freeze_time()
class CreateIssuePlatformOccurrenceTest(UptimeTestCase):
    @patch("sentry.uptime.issue_platform.produce_occurrence_to_kafka")
    @patch("sentry.uptime.issue_platform.uuid")
    def test(self, mock_uuid, mock_produce_occurrence_to_kafka):
        mock_uuid.uuid4.side_effect = cycle([uuid.uuid4(), uuid.uuid4()])
        result = self.create_uptime_result()
        project_subscription = self.create_project_uptime_subscription()
        create_issue_platform_occurrence(result, project_subscription)
        assert mock_produce_occurrence_to_kafka.call_count == 1
        assert mock_produce_occurrence_to_kafka.call_args_list[0][0] == ()
        call_kwargs = mock_produce_occurrence_to_kafka.call_args_list[0][1]
        occurrence = build_occurrence_from_result(result, project_subscription)
        assert call_kwargs == {
            "payload_type": PayloadType.OCCURRENCE,
            "occurrence": occurrence,
            "event_data": build_event_data_for_occurrence(result, project_subscription, occurrence),
        }


@freeze_time()
class BuildOccurrenceFromResultTest(UptimeTestCase):
    @patch("sentry.uptime.issue_platform.uuid")
    def test(self, mock_uuid):
        occurrence_id = uuid.uuid4()
        event_id = uuid.uuid4()
        mock_uuid.uuid4.side_effect = cycle([occurrence_id, event_id])
        result = self.create_uptime_result()
        project_subscription = self.create_project_uptime_subscription()
        assert build_occurrence_from_result(result, project_subscription) == IssueOccurrence(
            id=occurrence_id.hex,
            project_id=1,
            event_id=event_id.hex,
            fingerprint=[result["subscription_id"]],
            issue_title="Downtime detected for https://sentry.io",
            subtitle="Your monitored domain is down",
            resource_id=None,
            evidence_data={},
            evidence_display=[
                IssueEvidence(
                    name="Failure reason", value="timeout - it timed out", important=True
                ),
                IssueEvidence(name="Duration", value="100ms", important=False),
                IssueEvidence(name="Method", value="HEAD", important=False),
                IssueEvidence(name="Status Code", value="500", important=False),
            ],
            type=UptimeDomainCheckFailure,
            detection_time=datetime.datetime.now(datetime.UTC),
            level="error",
            culprit="",
            initial_issue_priority=None,
            assignee=None,
        )


@freeze_time()
class BuildEventDataForOccurrenceTest(UptimeTestCase):
    def test(self):
        result = self.create_uptime_result()
        event_id = uuid.uuid4()
        fingerprint = [result["subscription_id"]]
        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id=event_id.hex,
            fingerprint=fingerprint,
            issue_title="Downtime detected for https://sentry.io",
            subtitle="Your monitored domain is down",
            resource_id=None,
            evidence_data={},
            evidence_display=[],
            type=UptimeDomainCheckFailure,
            detection_time=datetime.datetime.now(datetime.UTC),
            level="error",
            culprit="",
        )
        project_subscription = self.create_project_uptime_subscription()
        event_data = build_event_data_for_occurrence(result, project_subscription, occurrence)
        assert event_data == {
            "environment": "development",
            "event_id": event_id.hex,
            "fingerprint": fingerprint,
            "platform": "other",
            "project_id": 1,
            "received": datetime.datetime.now().replace(microsecond=0),
            "sdk": None,
            "tags": {"uptime_rule": str(project_subscription.id)},
            "timestamp": occurrence.detection_time.isoformat(),
            "contexts": {
                "trace": {"trace_id": result["trace_id"], "span_id": result.get("span_id")}
            },
        }


class ResolveUptimeIssueTest(UptimeTestCase):
    def test(self):
        subscription = self.create_uptime_subscription(subscription_id=uuid.uuid4().hex)
        project_subscription = self.create_project_uptime_subscription(
            uptime_subscription=subscription
        )
        result = self.create_uptime_result(subscription.subscription_id)
        with self.feature(UptimeDomainCheckFailure.build_ingest_feature_name()):
            create_issue_platform_occurrence(result, project_subscription)
        hashed_fingerprint = md5(str(project_subscription.id).encode("utf-8")).hexdigest()
        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.status == GroupStatus.UNRESOLVED
        resolve_uptime_issue(project_subscription)
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
