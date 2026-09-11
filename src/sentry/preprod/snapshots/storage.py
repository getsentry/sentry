from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from uuid import uuid4

import orjson
from objectstore_client import RequestError, Session
from pydantic import BaseModel

from sentry.preprod.snapshots.manifest import (
    ChunkAssignment,
    ChunkResult,
    ComparisonManifest,
    ComparisonPlan,
)

_RETRYABLE_OBJECTSTORE_STATUSES = frozenset({429, 503})
_OBJECTSTORE_MAX_ATTEMPTS = 2
_OBJECTSTORE_RETRY_DELAY_S = 0.5


def _comparison_prefix(
    org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int
) -> str:
    return f"{org_id}/{project_id}/{head_artifact_id}/{base_artifact_id}"


def _plan_key(org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int) -> str:
    return f"{_comparison_prefix(org_id, project_id, head_artifact_id, base_artifact_id)}/plan.json"


def _chunk_result_key(
    org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int, chunk_index: int
) -> str:
    return f"{_comparison_prefix(org_id, project_id, head_artifact_id, base_artifact_id)}/chunks/{chunk_index}.json"


def _comparison_key(
    org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int
) -> str:
    return f"{_comparison_prefix(org_id, project_id, head_artifact_id, base_artifact_id)}/comparison.json"


def _diff_mask_key(
    org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int, stem: str
) -> str:
    return f"{_comparison_prefix(org_id, project_id, head_artifact_id, base_artifact_id)}/diff/{stem}.png"


def _retry_objectstore[T](operation: Callable[[], T]) -> T:
    for attempt in range(1, _OBJECTSTORE_MAX_ATTEMPTS + 1):
        try:
            return operation()
        except RequestError as e:
            if (
                e.status not in _RETRYABLE_OBJECTSTORE_STATUSES
                or attempt == _OBJECTSTORE_MAX_ATTEMPTS
            ):
                raise
            time.sleep(_OBJECTSTORE_RETRY_DELAY_S)
    raise AssertionError("unreachable")


def _read_objectstore(session: Session, key: str) -> bytes:
    response = session.get(key)
    if response is None:
        raise FileNotFoundError("Object does not exist in objectstore")
    try:
        return response.payload.read()
    finally:
        response.payload.close()


def _get_json[T: BaseModel](session: Session, key: str, model_cls: type[T]) -> T:
    return model_cls(**orjson.loads(_retry_objectstore(lambda: _read_objectstore(session, key))))


def _put_json(session: Session, key: str, model: BaseModel) -> None:
    payload = orjson.dumps(model.dict())
    _retry_objectstore(lambda: session.put(payload, key=key, content_type="application/json"))


def _put_diff_mask(session: Session, key: str, data: bytes) -> None:
    _retry_objectstore(lambda: session.put(data, key=key, content_type="image/png"))


@dataclass(frozen=True)
class ComparisonStorage:
    session: Session
    org_id: int
    project_id: int
    head_artifact_id: int
    base_artifact_id: int
    execution_id: str | None = None

    @property
    def prefix(self) -> str:
        prefix = _comparison_prefix(
            self.org_id, self.project_id, self.head_artifact_id, self.base_artifact_id
        )
        return f"{prefix}/runs/{self.execution_id}" if self.execution_id else prefix

    @property
    def plan_key(self) -> str:
        return f"{self.prefix}/plan.json"

    def read_plan(self) -> ComparisonPlan:
        plan = _get_json(self.session, self.plan_key, ComparisonPlan)
        if (plan.head_artifact_id, plan.base_artifact_id) != (
            self.head_artifact_id,
            self.base_artifact_id,
        ):
            raise ValueError("Comparison plan belongs to different artifacts")
        if (plan.schema_version == 2) != (self.execution_id is not None):
            raise ValueError("Comparison plan has an unexpected schema version")
        if self.execution_id is not None and any(
            chunk.chunk_index != index for index, chunk in enumerate(plan.chunks)
        ):
            raise ValueError("Comparison plan chunk indices are not contiguous")
        return plan

    def write_plan(self, plan: ComparisonPlan) -> None:
        _put_json(self.session, self.plan_key, plan)

    def assignment_key(self, chunk_index: int) -> str:
        return f"{self.prefix}/assignments/{chunk_index}.json"

    def write_assignment(self, assignment: ChunkAssignment) -> None:
        _put_json(self.session, self.assignment_key(assignment.chunk_index), assignment)

    def read_assignment(self, chunk_index: int) -> ChunkAssignment | None:
        if self.execution_id is None:
            return next(
                (chunk for chunk in self.read_plan().chunks if chunk.chunk_index == chunk_index),
                None,
            )
        assignment = _get_json(self.session, self.assignment_key(chunk_index), ChunkAssignment)
        if assignment.chunk_index != chunk_index or assignment.schema_version != 2:
            raise ValueError("Unexpected chunk assignment")
        return assignment

    def chunk_result_key(self, chunk_index: int) -> str:
        return f"{self.prefix}/chunks/{chunk_index}.json"

    def read_chunk_result(self, chunk_index: int) -> ChunkResult:
        result = _get_json(self.session, self.chunk_result_key(chunk_index), ChunkResult)
        if result.chunk_index != chunk_index:
            raise ValueError("Unexpected chunk result")
        return result

    def write_chunk_result(self, result: ChunkResult) -> None:
        _put_json(self.session, self.chunk_result_key(result.chunk_index), result)

    def write_comparison(self, manifest: ComparisonManifest) -> str:
        filename = f"comparison-{uuid4().hex}.json" if self.execution_id else "comparison.json"
        key = f"{self.prefix}/{filename}"
        _put_json(self.session, key, manifest)
        return key

    def task_kwargs(self) -> dict[str, int | str]:
        kwargs: dict[str, int | str] = {
            "org_id": self.org_id,
            "project_id": self.project_id,
            "head_artifact_id": self.head_artifact_id,
            "base_artifact_id": self.base_artifact_id,
        }
        if self.execution_id is not None:
            kwargs["execution_id"] = self.execution_id
        return kwargs
