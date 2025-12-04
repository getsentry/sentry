from datetime import UTC, datetime
from uuid import uuid4

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.apidocs.parameters import GlobalParams
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import GroupType, WebVitalsGroup
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.organization import Organization
from sentry.models.project import Project


class BaseUserIssueFormatter:
    def __init__(self, data: dict):
        self.data = data

    def get_issue_type(self) -> type[GroupType]:
        raise NotImplementedError

    def get_issue_title(self) -> str:
        raise NotImplementedError

    def get_issue_subtitle(self) -> str:
        raise NotImplementedError

    def create_fingerprint(self) -> list[str]:
        raise NotImplementedError

    def get_tags(self) -> dict:
        raise NotImplementedError

    def get_evidence(self) -> tuple[dict, list[IssueEvidence]]:
        raise NotImplementedError


class DefaultUserIssueFormatter(BaseUserIssueFormatter):
    def get_issue_type(self) -> type[GroupType]:
        return ErrorGroupType

    def get_issue_title(self) -> str:
        return f"{self.data.get('transaction')}"

    def get_issue_subtitle(self) -> str:
        return f"User flagged issue on {self.data.get('transaction')}"

    def create_fingerprint(self) -> list[str]:
        #  By default, return a random UUID for a unique group
        return [uuid4().hex]

    def get_tags(self) -> dict:
        return {"transaction": self.data.get("transaction")}

    def get_evidence(self) -> tuple[dict, list[IssueEvidence]]:
        transaction = self.data.get("transaction", "")

        evidence_data = {
            "transaction": transaction,
        }

        evidence_display = [
            IssueEvidence(
                name="Transaction",
                value=transaction,
                important=False,
            ),
        ]
        return (evidence_data, evidence_display)


class WebVitalsUserIssueFormatter(BaseUserIssueFormatter):
    def get_issue_type(self) -> type[GroupType]:
        return WebVitalsGroup

    def get_issue_title(self) -> str:
        vital = self.data.get("vital", "")
        return f"{vital.upper()} score needs improvement"

    def get_issue_subtitle(self) -> str:
        vital = self.data.get("vital", "")
        transaction = self.data.get("transaction", "")
        a_or_an = "an" if vital in ["lcp", "fcp", "inp"] else "a"
        return f"{transaction} has {a_or_an} {vital.upper()} score of {self.data.get("score")}"

    def create_fingerprint(self) -> list[str]:
        vital = self.data.get("vital", "")
        transaction = self.data.get("transaction", "")
        # We add a uuid to force uniqueness on the fingerprint
        # This is because we do not want historic autofix runs to be connected to new issue events
        uuid = uuid4().hex
        return [f"insights-web-vitals-{vital}-{transaction}-{uuid}"]

    def get_tags(self) -> dict:
        vital = self.data.get("vital", "")
        transaction = self.data.get("transaction", "")
        return {
            "transaction": transaction,
            "web_vital": vital,
            "score": str(self.data.get("score")),
            vital: str(self.data.get("value", "")),
        }

    def get_evidence(self) -> tuple[dict, list[IssueEvidence]]:
        vital = self.data.get("vital", "")
        score = self.data.get("score")
        transaction = self.data.get("transaction", "")
        trace_id = self.data.get("traceId")
        vital_value = self.data.get("value")

        evidence_data = {
            "transaction": transaction,
            "vital": vital,
            "score": score,
            vital: vital_value,
        }

        evidence_display = [
            IssueEvidence(
                name="Transaction",
                value=transaction,
                important=False,
            ),
            IssueEvidence(
                name="Web Vital",
                value=vital.upper(),
                important=True,
            ),
            IssueEvidence(
                name="Score",
                value=str(score),
                important=True,
            ),
            IssueEvidence(
                name=vital.upper(),
                value=str(vital_value),
                important=True,
            ),
        ]

        if trace_id:
            evidence_data["trace_id"] = trace_id
            evidence_display.append(
                IssueEvidence(
                    name="Trace ID",
                    value=trace_id,
                    important=False,
                )
            )

        return (evidence_data, evidence_display)


ISSUE_TYPE_CHOICES = [
    WebVitalsGroup.slug,
]


class ProjectUserIssueRequestSerializer(serializers.Serializer):
    transaction = serializers.CharField(required=True)
    issueType = serializers.ChoiceField(required=True, choices=ISSUE_TYPE_CHOICES)
    traceId = serializers.CharField(required=False)
    timestamp = serializers.DateTimeField(required=False)


class WebVitalsIssueDataSerializer(ProjectUserIssueRequestSerializer):
    score = serializers.IntegerField(required=True, min_value=0, max_value=100)
    vital = serializers.ChoiceField(required=True, choices=["lcp", "fcp", "cls", "inp", "ttfb"])
    value = serializers.IntegerField(required=True)


class ProjectUserIssuePermission(ProjectPermission):
    scope_map = {
        "GET": [],
        "POST": ["event:read", "event:write", "event:admin"],
        "PUT": [],
        "DELETE": [],
    }


class ProjectUserIssueResponseSerializer(serializers.Serializer):
    event_id = serializers.CharField(required=True)


@region_silo_endpoint
class ProjectUserIssueEndpoint(ProjectEndpoint):
    permission_classes = (ProjectUserIssuePermission,)
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.DATA_BROWSING

    def get_formatter(self, data: dict) -> BaseUserIssueFormatter:
        if data.get("issueType") == WebVitalsGroup.slug:
            return WebVitalsUserIssueFormatter(data)
        return DefaultUserIssueFormatter(data)

    def get_serializer(self, data: dict) -> serializers.Serializer:
        if data.get("issueType") == WebVitalsGroup.slug:
            return WebVitalsIssueDataSerializer(data=data)
        return ProjectUserIssueRequestSerializer(data=data)

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has(
            "organizations:performance-web-vitals-seer-suggestions",
            organization,
            actor=request.user,
        )

    @extend_schema(
        operation_id="Create a user defined issue",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=ProjectUserIssueRequestSerializer,
        responses={
            200: ProjectUserIssueResponseSerializer,
        },
    )
    def post(self, request: Request, project: Project) -> Response:
        """
        Create a user defined issue.
        """

        organization = project.organization

        if not self.has_feature(organization, request):
            return Response(status=404)

        serializer = self.get_serializer(request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data

        formatter = self.get_formatter(validated_data)

        issue_type = formatter.get_issue_type()

        fingerprint = formatter.create_fingerprint()

        formatted_title = formatter.get_issue_title()
        formatted_subtitle = formatter.get_issue_subtitle()

        event_id = uuid4().hex
        now = datetime.now(UTC)

        event_data = {
            "event_id": event_id,
            "project_id": project.id,
            "platform": project.platform,
            "timestamp": now.isoformat(),
            "received": now.isoformat(),
            "tags": formatter.get_tags(),
        }

        if validated_data.get("timestamp"):
            event_data["timestamp"] = validated_data["timestamp"].isoformat()

        if validated_data.get("traceId"):
            event_data["contexts"] = {
                "trace": {
                    "trace_id": validated_data["traceId"],
                    "type": "trace",
                }
            }

        (evidence_data, evidence_display) = formatter.get_evidence()

        occurence = IssueOccurrence(
            id=uuid4().hex,
            event_id=event_id,
            project_id=project.id,
            fingerprint=fingerprint,
            issue_title=formatted_title,
            subtitle=formatted_subtitle,
            resource_id=None,
            evidence_data=evidence_data,
            evidence_display=evidence_display,
            type=issue_type,
            detection_time=now,
            culprit=validated_data.get("transaction"),
            level="info",
        )

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE, occurrence=occurence, event_data=event_data
        )

        return Response({"event_id": event_id}, status=200)
