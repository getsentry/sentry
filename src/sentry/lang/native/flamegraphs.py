from collections.abc import Generator
from copy import deepcopy
from typing import Any

import orjson

from sentry import features
from sentry.attachments import (
    CachedAttachment,
    get_attachments_for_event,
    store_attachments_for_event,
)
from sentry.ingest.consumer import CACHE_TIMEOUT
from sentry.lang.native.frames import get_frames_for_symbolication, merge_frame
from sentry.lang.native.utils import is_native_platform
from sentry.models.project import Project

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
    debug_meta = payload.get("debug_meta", {})
    if not isinstance(debug_meta, dict):
        return False
    images = debug_meta.get("images", [])
    if not isinstance(images, list) or not all(isinstance(image, dict) for image in images):
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


def _expand_inline_frames(trees: list[dict[str, Any]], chains: dict[int, list[int]]) -> None:
    nodes = [root for tree in trees for root in tree["roots"]]
    while nodes:
        node = nodes.pop()
        children = node.get("children")
        nodes.extend(children or [])
        chain = chains.get(node["frame_id"])
        if not chain or len(chain) == 1:
            continue
        node.pop("children", None)
        current = node
        for frame_id in chain[1:]:
            child = {"frame_id": frame_id, "sample_count": node["sample_count"]}
            current["children"] = [child]
            current = child
        if children is not None:
            current["children"] = children


def get_flamegraph_stacktraces(
    payload: dict[str, Any], modules: list[dict[str, Any]]
) -> tuple[list[int], list[dict[str, Any]]]:
    frame_ids = []
    stacktraces = []
    for frame_id, frame in enumerate(payload["frames"][:MAX_SYMBOLICATION_FRAMES]):
        if not is_native_platform(frame.get("platform", payload["platform"])):
            continue
        frames = get_frames_for_symbolication([frame], payload, modules, adjustment="none")
        if frames:
            frame_ids.append(frame_id)
            stacktraces.append({"frames": frames})
    return frame_ids, stacktraces


def _merge_symbolicated_frames(
    payload: dict[str, Any], frame_ids: list[int], stacktraces: list[dict[str, Any]]
) -> dict[str, Any]:
    output = deepcopy(payload)
    chains = {}
    for frame_id, stacktrace in zip(frame_ids, stacktraces):
        original = payload["frames"][frame_id]
        resolved = stacktrace.get("frames", [])
        if not resolved or any(
            frame.get("status") not in (None, "symbolicated") for frame in resolved
        ):
            continue
        chain = []
        for position, frame in enumerate(resolved):
            merged = deepcopy(original)
            merge_frame(merged, frame, original.get("platform", payload["platform"]))
            # Symbolicator may adjust addresses or normalize relative addressing modes.
            # The diagnostic must retain its captured symbolication inputs.
            merged["instruction_addr"] = original["instruction_addr"]
            if "addr_mode" in original:
                merged["addr_mode"] = original["addr_mode"]
            else:
                merged.pop("addr_mode", None)
            if position == 0:
                output["frames"][frame_id] = merged
                chain.append(frame_id)
            else:
                chain.append(len(output["frames"]))
                output["frames"].append(merged)
        chains[frame_id] = chain
    _expand_inline_frames(output["trees"], chains)
    output["_symbolication"] = {
        "status": "completed",
        "frames": payload["frames"],
        "trees": payload["trees"],
    }
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
            raw = attachment.load_data(self._project)
            if len(raw) > MAX_FLAMEGRAPH_SIZE:
                continue
            try:
                payload = orjson.loads(raw)
            except orjson.JSONDecodeError:
                continue
            if not isinstance(payload, dict):
                continue
            state = payload.get("_symbolication")
            if isinstance(state, dict):
                if state.get("status") == "completed":
                    continue
                payload["frames"] = state.get("frames", payload.get("frames"))
                payload["trees"] = state.get("trees", payload.get("trees"))
            if _is_valid_flamegraph(payload):
                yield index, payload

    def apply_response_and_save(
        self,
        attachment_index: int,
        payload: dict[str, Any],
        frame_ids: list[int],
        response: Any,
    ) -> bool:
        if not response or response.get("status") != "completed":
            return False
        stacktraces = response.get("stacktraces", [])
        if len(stacktraces) != len(frame_ids):
            return False
        output = _merge_symbolicated_frames(payload, frame_ids, stacktraces)
        serialized = orjson.dumps(output)
        attachment = self._attachments[attachment_index]
        metadata = attachment.meta()
        metadata.update(data=serialized, chunks=None, size=len(serialized))
        self._attachments[attachment_index] = CachedAttachment(**metadata)
        # Checkpoint before the next request, which may exhaust the event's timeout.
        store_attachments_for_event(
            self._project, self._event, self._attachments, timeout=CACHE_TIMEOUT
        )
        # Reload metadata so later checkpoints don't rewrite earlier processed payloads.
        self._attachments = list(get_attachments_for_event(self._event))
        return True
