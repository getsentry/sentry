from collections.abc import Generator
from typing import Any

import rapidjson
from rest_framework import serializers

from sentry import features
from sentry.attachments import (
    CachedAttachment,
    MissingAttachmentChunks,
    get_attachments_for_event,
    store_attachments_for_event,
)
from sentry.ingest.consumer import CACHE_TIMEOUT
from sentry.models.project import Project

# See: https://develop.sentry.dev/sdk/telemetry/attachments/#flame-graph-validation-and-limits
MAX_FLAMEGRAPH_SIZE = 10 * 1024 * 1024
MAX_SYMBOLICATION_FRAMES = 2500
MAX_SAMPLE_COUNT = 9007199254740991


class _StringField(serializers.Field):
    default_error_messages = {"invalid": "Not a valid string."}

    def to_internal_value(self, data: Any) -> str:
        # Attachment validation must not coerce JSON numbers to strings.
        if not isinstance(data, str):
            self.fail("invalid")
        return data


class _IntegerField(serializers.IntegerField):
    def to_internal_value(self, data: Any) -> int:
        # Reject booleans, floats, and numeric strings rather than normalizing them.
        if type(data) is not int:
            self.fail("invalid")
        return data


class _FrameSerializer(serializers.Serializer):
    filename = serializers.JSONField(required=False, allow_null=True)
    function = serializers.JSONField(required=False, allow_null=True)
    instruction_addr = _StringField(required=False)
    addr_mode = _StringField(required=False)
    platform = _StringField(required=False)
    data = serializers.DictField(required=False)  # type: ignore[assignment]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not any(
            isinstance(attrs.get(field), str) and attrs[field]
            for field in ("filename", "function", "instruction_addr")
        ):
            raise serializers.ValidationError("A frame must have a filename, function, or address.")
        return attrs


class _ImageSerializer(serializers.Serializer):
    debug_id = _StringField(required=False, allow_null=True)
    id = _StringField(required=False, allow_null=True)
    uuid = _StringField(required=False, allow_null=True)


class _DebugMetaSerializer(serializers.Serializer):
    images = _ImageSerializer(many=True, required=False)


class _NodeSerializer(serializers.Serializer):
    frame_id = _IntegerField(min_value=0)
    sample_count = _IntegerField(min_value=1, max_value=MAX_SAMPLE_COUNT)
    children = serializers.ListField(child=_IntegerField(min_value=0), required=False)


class _TreeSerializer(serializers.Serializer):
    roots = serializers.ListField(child=_IntegerField(min_value=0), allow_empty=False)


class _FlamegraphSerializer(serializers.Serializer):
    version = _StringField()
    platform = _StringField()
    frames = _FrameSerializer(many=True, allow_empty=False)
    debug_meta = _DebugMetaSerializer(required=False)
    nodes = _NodeSerializer(many=True, allow_empty=False)
    trees = _TreeSerializer(many=True, allow_empty=False)

    def validate_version(self, value: str) -> str:
        if value != "1":
            raise serializers.ValidationError("Unsupported flamegraph version.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        frames, nodes = attrs["frames"], attrs["nodes"]
        # Check the indexed table directly, rather than walking potentially cyclic or shared paths.
        for node in nodes:
            if node["frame_id"] >= len(frames):
                raise serializers.ValidationError("Frame index is out of bounds.")
            children = node.get("children", [])
            if any(child >= len(nodes) for child in children):
                raise serializers.ValidationError("Child index is out of bounds.")
            if sum(nodes[child]["sample_count"] for child in children) > node["sample_count"]:
                raise serializers.ValidationError("Child sample counts exceed the parent count.")
        for tree in attrs["trees"]:
            if any(root >= len(nodes) for root in tree["roots"]):
                raise serializers.ValidationError("Root index is out of bounds.")
        return attrs


def _is_valid_flamegraph(payload: Any) -> bool:
    # Validate without replacing the payload, preserving unknown fields and captured values.
    return _FlamegraphSerializer(data=payload).is_valid()


def expand_inline_frames(
    nodes: list[dict[str, Any]], chains: dict[int, list[int]]
) -> list[dict[str, Any]]:
    # Keep captured indices stable so roots and shared child references remain valid.
    output = [dict(node) for node in nodes]
    for index, original in enumerate(nodes):
        current = output[index]
        for frame_id in chains.get(original["frame_id"], [])[1:]:
            child = {"frame_id": frame_id, "sample_count": original["sample_count"]}
            current["children"] = [len(output)]
            output.append(child)
            current = child
        if "children" in original:
            current["children"] = list(original["children"])
    return output


class Flamegraphs:
    def __init__(self, project: Project, data: Any):
        self._project = project
        self._event = data
        self._attachments = list(get_attachments_for_event(data))

    def get_flamegraphs(self) -> Generator[tuple[int, dict[str, Any]]]:
        if not any(attachment.type == "event.flamegraph" for attachment in self._attachments):
            return
        if not features.has("organizations:flamegraph-attachments", self._project.organization):
            return
        for index, attachment in enumerate(self._attachments):
            if attachment.type != "event.flamegraph":
                continue
            try:
                raw = attachment.load_data(self._project)
            except (MissingAttachmentChunks, FileNotFoundError):
                continue
            if len(raw) > MAX_FLAMEGRAPH_SIZE:
                continue
            try:
                payload = rapidjson.loads(raw, allow_nan=False)
            except (rapidjson.JSONDecodeError, UnicodeDecodeError):
                continue
            if not isinstance(payload, dict):
                continue
            state = payload.get("_symbolication")
            if isinstance(state, dict) and state.get("status") == "completed":
                continue
            if _is_valid_flamegraph(payload):
                yield index, payload

    def save(self, attachment_index: int, payload: dict[str, Any]) -> bool:
        serialized = rapidjson.dumps(payload, ensure_ascii=False, allow_nan=False).encode()
        if len(serialized) > MAX_FLAMEGRAPH_SIZE:
            return False
        attachment = self._attachments[attachment_index]
        metadata = attachment.meta()
        metadata.update(data=serialized, chunks=None, size=len(serialized))
        # Checkpoint only this attachment, without reading or rewriting unrelated payloads.
        checkpoint = dict(self._event)
        store_attachments_for_event(
            self._project, checkpoint, [CachedAttachment(**metadata)], timeout=CACHE_TIMEOUT
        )
        self._event["_attachments"][attachment_index] = checkpoint["_attachments"][0]
        return True
