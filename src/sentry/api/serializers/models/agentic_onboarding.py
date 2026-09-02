from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers import Serializer
from sentry.api.serializers.rest_framework import convert_dict_key_case, snake_to_camel_case
from sentry.onboarding.agentic_progress.model import (
    OnboardingRun,
    RunStatus,
    Stage,
    StageExtra,
    StageStatus,
)
from sentry.utils import json


class AgenticOnboardingStageResponse(TypedDict):
    stage: Stage
    status: StageStatus | None
    eventNote: str | None
    extra: dict[str, Any] | None


def serialize_stage_extra(extra: StageExtra | None) -> dict[str, Any] | None:
    if extra is None:
        return None

    return convert_dict_key_case(json.loads(extra.json()), snake_to_camel_case)


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
            stages=[
                AgenticOnboardingStageResponse(
                    stage=state.stage,
                    status=state.status,
                    eventNote=state.event_note,
                    extra=serialize_stage_extra(state.extra),
                )
                for state in obj.stages
            ],
        )

        onboarding_code = kwargs.get("onboarding_code")
        if onboarding_code is not None:
            data["onboardingCode"] = onboarding_code

        return data
