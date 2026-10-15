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
from sentry.lang.native.frames import get_frames_for_symbolication, merge_frame
from sentry.lang.native.utils import is_native_image
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


def _expand_inline_frames(
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


def get_flamegraph_stacktraces(payload: dict[str, Any]) -> tuple[list[int], list[dict[str, Any]]]:
    frame_ids = []
    stacktraces = []
    original_modules = payload.get("debug_meta", {}).get("images", [])
    module_indices: dict[int, int] = {}
    for index, image in enumerate(original_modules):
        if is_native_image(image):
            module_indices[index] = len(module_indices)
    for frame_id, frame in enumerate(payload["frames"][:MAX_SYMBOLICATION_FRAMES]):
        frames = get_frames_for_symbolication([frame], payload, original_modules, adjustment="none")
        if not frames:
            continue
        # Resolve against the captured image table before remapping to the filtered request.
        addr_mode = frames[0].get("addr_mode")
        if frame.get("addr_mode", "").startswith("rel:") and addr_mode is None:
            continue
        if addr_mode is not None:
            module_index = module_indices.get(int(addr_mode[4:]))
            if module_index is None:
                continue
            frames[0]["addr_mode"] = f"rel:{module_index}"
        frame_ids.append(frame_id)
        stacktraces.append({"frames": frames})
    return frame_ids, stacktraces


def _merge_symbolicated_frames(
    payload: dict[str, Any], frame_ids: list[int], stacktraces: list[dict[str, Any]]
) -> dict[str, Any]:
    output = {**payload, "frames": list(payload["frames"])}
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
            merged = dict(original)
            if "data" in merged:
                merged["data"] = dict(merged["data"])
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
    output["trees"] = _expand_inline_frames(payload["trees"], chains)
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
        serialized = rapidjson.dumps(output, ensure_ascii=False, allow_nan=False).encode()
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
