from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers import Serializer
from sentry.onboarding.agentic_progress.model import OnboardingRun, RunStatus, Stage, StageStatus


class AgenticOnboardingStageResponse(TypedDict):
    stage: Stage
    status: StageStatus | None
    eventNote: str | None


class AgenticOnboardingRunResponse(TypedDict):
    schemaVersion: int
    runId: str
    channelId: str
    onboardingCode: NotRequired[str]
    clientRunId: str
    createdAt: str
    updatedAt: str
    sequence: int
    expiresAt: str
    continueUpdates: bool
    runStatus: RunStatus
    projectSlugs: list[str]
    issueIds: list[str]
    stages: list[AgenticOnboardingStageResponse]


class AgenticOnboardingRunSerializer(Serializer[AgenticOnboardingRunResponse]):
    def serialize(
        self,
        obj: OnboardingRun,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> AgenticOnboardingRunResponse:
        data = AgenticOnboardingRunResponse(
            schemaVersion=obj.schema_version,
            runId=obj.run_id,
            channelId=obj.channel_id,
            clientRunId=obj.client_run_id,
            createdAt=obj.created_at.isoformat(),
            updatedAt=obj.updated_at.isoformat(),
            sequence=obj.sequence,
            expiresAt=obj.expires_at.isoformat(),
            continueUpdates=obj.run_status is RunStatus.ACTIVE,
            runStatus=obj.run_status,
            projectSlugs=list(obj.project_slugs),
            issueIds=list(obj.issue_ids),
            stages=[
                AgenticOnboardingStageResponse(
                    stage=state.stage,
                    status=state.status,
                    eventNote=state.event_note,
                )
                for state in obj.stages
            ],
        )

        onboarding_code = kwargs.get("onboarding_code")
        if onboarding_code is not None:
            data["onboardingCode"] = onboarding_code

        return data
