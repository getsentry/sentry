from collections.abc import Generator
from typing import Any

import rapidjson

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


def _is_valid_flamegraph(payload: Any) -> bool:
    if not isinstance(payload, dict) or payload.get("version") != "1":
        return False
    if not isinstance(payload.get("platform"), str):
        return False
    frames = payload.get("frames")
    trees = payload.get("trees")
    if not isinstance(frames, list) or not frames or not isinstance(trees, list) or not trees:
        return False
    for frame in frames:
        if not isinstance(frame, dict) or not any(
            isinstance(frame.get(field), str) and frame[field]
            for field in ("filename", "function", "instruction_addr")
        ):
            return False
        if "instruction_addr" in frame and not isinstance(frame["instruction_addr"], str):
            return False
        if "addr_mode" in frame and not isinstance(frame["addr_mode"], str):
            return False
        if "platform" in frame and not isinstance(frame["platform"], str):
            return False
        if "data" in frame and not isinstance(frame["data"], dict):
            return False
    debug_meta = payload.get("debug_meta", {})
    if not isinstance(debug_meta, dict):
        return False
    images = debug_meta.get("images", [])
    if not isinstance(images, list) or not all(isinstance(image, dict) for image in images):
        return False
    for image in images:
        if any(
            image.get(field) is not None and not isinstance(image[field], str)
            for field in ("debug_id", "id", "uuid")
        ):
            return False
    for tree in trees:
        if (
            not isinstance(tree, dict)
            or not isinstance(tree.get("roots"), list)
            or not tree["roots"]
        ):
            return False
        nodes = list(tree["roots"])
        while nodes:
            node = nodes.pop()
            if not isinstance(node, dict):
                return False
            frame_id = node.get("frame_id")
            count = node.get("sample_count")
            if type(frame_id) is not int or not 0 <= frame_id < len(frames):
                return False
            if type(count) is not int or not 0 < count <= MAX_SAMPLE_COUNT:
                return False
            children = node.get("children", [])
            if not isinstance(children, list) or not all(
                isinstance(child, dict) for child in children
            ):
                return False
            child_counts = [child.get("sample_count") for child in children]
            if any(type(value) is not int or value <= 0 for value in child_counts):
                return False
            if sum(child_counts) > count:
                return False
            nodes.extend(children)
    return True


def expand_inline_frames(
    trees: list[dict[str, Any]], chains: dict[int, list[int]]
) -> list[dict[str, Any]]:
    output = [{**tree, "roots": []} for tree in trees]
    nodes = [
        (root, new_tree["roots"])
        for tree, new_tree in zip(trees, output)
        for root in reversed(tree["roots"])
    ]
    while nodes:
        original, siblings = nodes.pop()
        node = dict(original)
        siblings.append(node)
        children = node.pop("children", None)
        current = node
        for frame_id in chains.get(node["frame_id"], [])[1:]:
            child = {"frame_id": frame_id, "sample_count": node["sample_count"]}
            current["children"] = [child]
            current = child
        if children is not None:
            current["children"] = []
            nodes.extend((child, current["children"]) for child in reversed(children))
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
