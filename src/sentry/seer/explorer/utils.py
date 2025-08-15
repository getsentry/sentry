import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any

import orjson

from sentry.models.project import Project
from sentry.profiles.profile_chunks import get_chunk_ids
from sentry.profiles.utils import get_from_profiling_service
from sentry.search.events.types import SnubaParams
from sentry.seer.sentry_data_models import ExecutionTreeNode

logger = logging.getLogger(__name__)


def normalize_description(description: str) -> str:
    """
    Normalize span descriptions by removing UUIDs, long numeric strings,
    and other variable identifiers to enable aggregation.
    """
    if not description:
        return ""

    # Remove UUIDs (32 hex chars with or without dashes)
    description = re.sub(
        r"\b[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}\b",
        "<UUID>",
        description,
        flags=re.IGNORECASE,
    )

    # Remove long numeric sequences (6+ digits)
    description = re.sub(r"\b\d{6,}\b", "<NUM>", description)

    # Remove hex strings (8+ hex chars)
    description = re.sub(r"0x[a-f0-9]{8,}\b", "0x<HEX>", description, flags=re.IGNORECASE)
    description = re.sub(r"\b[a-f0-9]{8,}\b", "<HEX>", description, flags=re.IGNORECASE)

    # Remove timestamps
    description = re.sub(r"\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}", "<TIMESTAMP>", description)

    # Clean up extra whitespace
    description = re.sub(r"\s+", " ", description).strip()

    return description


def _convert_profile_to_execution_tree(profile_data: dict) -> list[dict]:
    """
    Converts profile data into a hierarchical representation of code execution,
    including only items from the MainThread and app frames.
    Calculates accurate durations for all nodes based on call stack transitions.
    """
    profile = profile_data.get(
        "profile"
    )  # transaction profiles are formatted as {"profile": {"frames": [], "samples": [], "stacks": []}}
    if not profile:
        profile = profile_data.get("chunk", {}).get(
            "profile"
        )  # continuous profiles are wrapped as {"chunk": {"profile": {"frames": [], "samples": [], "stacks": []}}}
        if not profile:
            return []

    frames = profile.get("frames")
    stacks = profile.get("stacks")
    samples = profile.get("samples")
    if not all([frames, stacks, samples]):
        return []

    # Find the MainThread ID
    thread_metadata = profile.get("thread_metadata", {}) or {}
    main_thread_id = next(
        (key for key, value in thread_metadata.items() if value.get("name") == "MainThread"), None
    )
    if (
        not main_thread_id and len(thread_metadata) == 1
    ):  # if there is only one thread, use that as the main thread
        main_thread_id = list(thread_metadata.keys())[0]

    def _get_elapsed_since_start_ns(
        sample: dict[str, Any], all_samples: list[dict[str, Any]]
    ) -> int:
        """
        Get the elapsed time since start for a sample.
        Handles both transaction and continuous profiles.
        """
        if "elapsed_since_start_ns" in sample:
            return sample["elapsed_since_start_ns"]
        elif "timestamp" in sample:
            min_timestamp = min(s["timestamp"] for s in all_samples)
            return int((sample["timestamp"] - min_timestamp) * 1e9)
        else:
            return 0

    # Sort samples chronologically
    sorted_samples = sorted(samples, key=lambda x: _get_elapsed_since_start_ns(x, samples))

    # Calculate average sampling interval
    if len(sorted_samples) >= 2:
        time_diffs = [
            _get_elapsed_since_start_ns(sorted_samples[i + 1], sorted_samples)
            - _get_elapsed_since_start_ns(sorted_samples[i], sorted_samples)
            for i in range(len(sorted_samples) - 1)
        ]
        sample_interval_ns = int(sum(time_diffs) / len(time_diffs)) if time_diffs else 10000000
    else:
        sample_interval_ns = 10000000  # default 10ms

    def create_frame_node(frame_index: int) -> dict[str, Any]:
        """Create a node representation for a single frame"""
        frame = frames[frame_index]
        return {
            "function": frame.get("function", ""),
            "module": frame.get("module", ""),
            "filename": frame.get("filename", ""),
            "lineno": frame.get("lineno", 0),
            "in_app": frame.get("in_app", False),
            "children": [],
            "node_id": None,
            "sample_count": 0,
            "first_seen_ns": None,
            "last_seen_ns": None,
            "duration_ns": None,
        }

    def get_node_path(node: dict[str, Any], parent_path: str = "") -> str:
        """Generate a unique path identifier for a node"""
        return f"{parent_path}/{node['function']}:{node['filename']}:{node['lineno']}"

    def find_or_create_child(parent: dict[str, Any], frame_data: dict[str, Any]) -> dict[str, Any]:
        """Find existing child node or create new one"""
        for child in parent["children"]:
            if (
                child["function"] == frame_data["function"]
                and child["module"] == frame_data["module"]
                and child["filename"] == frame_data["filename"]
                and child["lineno"] == frame_data["lineno"]
            ):
                return child

        parent["children"].append(frame_data)
        return frame_data

    def process_stack(stack_index):
        """Extract app frames from a stack trace"""
        frame_indices = stacks[stack_index]
        if not frame_indices:
            return []

        # Create nodes for app frames only, maintaining order (bottom to top)
        nodes = []
        for idx in reversed(frame_indices):
            frame = frames[idx]
            if frame.get("in_app", False) and not (
                frame.get("filename", "").startswith("<")
                and frame.get("filename", "").endswith(">")
            ):
                nodes.append(create_frame_node(idx))

        return nodes

    # Build the execution tree and track call stacks
    execution_tree: list[dict[str, Any]] = []
    call_stack_history: list[tuple[list[str], int]] = []  # [(node_ids, timestamp), ...]
    node_registry: dict[str, dict[str, Any]] = {}  # {node_id: node_reference}

    for sample in sorted_samples:
        if str(sample["thread_id"]) != str(main_thread_id):
            continue

        timestamp_ns = _get_elapsed_since_start_ns(sample, sorted_samples)
        stack_frames = process_stack(sample["stack_id"])
        if not stack_frames:
            continue

        # Process this stack sample
        current_stack_ids = []

        # Find or create root node
        root = None
        for existing_root in execution_tree:
            if (
                existing_root["function"] == stack_frames[0]["function"]
                and existing_root["module"] == stack_frames[0]["module"]
                and existing_root["filename"] == stack_frames[0]["filename"]
                and existing_root["lineno"] == stack_frames[0]["lineno"]
            ):
                root = existing_root
                break

        if root is None:
            root = stack_frames[0]
            execution_tree.append(root)

        # Process root node
        if root["node_id"] is None:
            node_id = get_node_path(root)
            root["node_id"] = node_id
            node_registry[node_id] = root
            root["first_seen_ns"] = timestamp_ns

        root["sample_count"] += 1
        root["last_seen_ns"] = timestamp_ns
        current_stack_ids.append(root["node_id"])

        # Process rest of the stack
        current = root
        current_path = root["node_id"]

        for frame in stack_frames[1:]:
            current = find_or_create_child(current, frame)

            if current["node_id"] is None:
                node_id = get_node_path(current, current_path)
                current["node_id"] = node_id
                node_registry[node_id] = current
                current["first_seen_ns"] = timestamp_ns

            current["sample_count"] += 1
            current["last_seen_ns"] = timestamp_ns
            current_stack_ids.append(current["node_id"])
            current_path = current["node_id"]

        # Record this call stack with its timestamp
        call_stack_history.append((current_stack_ids, timestamp_ns))

    # Calculate function active periods from call stack history
    function_periods: dict[str, list[list[int | None]]] = {}

    for i, (call_path, timestamp) in enumerate(call_stack_history):
        # Mark functions as started
        for node_id in call_path:
            if node_id not in function_periods:
                function_periods[node_id] = []

            # Start a new period if needed
            if not function_periods[node_id] or function_periods[node_id][-1][1] is not None:
                function_periods[node_id].append([timestamp, None])

        # Mark functions that disappeared as ended
        if i > 0:
            prev_call_path = call_stack_history[i - 1][0]
            for node_id in prev_call_path:
                if node_id not in call_path and function_periods.get(node_id):
                    if function_periods[node_id][-1][1] is None:
                        function_periods[node_id][-1][1] = timestamp

    # Handle the last sample - all active functions end
    if call_stack_history:
        last_timestamp = call_stack_history[-1][1]
        last_call_path = call_stack_history[-1][0]

        for node_id in last_call_path:
            if function_periods.get(node_id) and function_periods[node_id][-1][1] is None:
                function_periods[node_id][-1][1] = last_timestamp + sample_interval_ns

    # Calculate durations
    def apply_durations(node):
        """Calculate and set duration for a node and its children"""
        node_id = node["node_id"]

        # Primary method: use function periods if available
        if node_id in function_periods:
            periods = function_periods[node_id]
            total_duration = sum(
                (end - start) for start, end in periods if start is not None and end is not None
            )

            if total_duration > 0:
                node["duration_ns"] = total_duration

        # Apply to all children
        for child in node["children"]:
            apply_durations(child)

        # Fallback methods if needed
        if node["duration_ns"] is None or node["duration_ns"] == 0:
            # Method 1: Use first and last seen timestamps
            if node["first_seen_ns"] is not None and node["last_seen_ns"] is not None:
                node["duration_ns"] = (
                    node["last_seen_ns"] - node["first_seen_ns"] + sample_interval_ns
                )

            # Method 2: Use sample count as an estimate
            elif node["sample_count"] > 0:
                node["duration_ns"] = node["sample_count"] * sample_interval_ns

            # Method 3: Use sum of children's durations
            elif node["children"]:
                child_duration = sum(
                    child["duration_ns"]
                    for child in node["children"]
                    if child["duration_ns"] is not None
                )
                if child_duration > 0:
                    node["duration_ns"] = child_duration

    # Apply durations to all nodes
    for node in execution_tree:
        apply_durations(node)

    return execution_tree


def convert_profile_to_execution_tree(profile_data: dict) -> list[ExecutionTreeNode]:
    """
    Converts profile data into a hierarchical representation of code execution,
    including only items from the MainThread and app frames.
    Calculates accurate durations for all nodes based on call stack transitions.
    """
    dict_tree = _convert_profile_to_execution_tree(profile_data)

    def dict_to_execution_tree_node(node_dict: dict) -> ExecutionTreeNode:
        """Convert a dict node to an ExecutionTreeNode Pydantic object."""
        children = [dict_to_execution_tree_node(child) for child in node_dict.get("children", [])]

        return ExecutionTreeNode(
            function=node_dict.get("function", ""),
            module=node_dict.get("module", ""),
            filename=node_dict.get("filename", ""),
            lineno=node_dict.get("lineno", 0),
            in_app=node_dict.get("in_app", False),
            children=children,
            node_id=node_dict.get("node_id"),
            sample_count=node_dict.get("sample_count", 0),
            first_seen_ns=node_dict.get("first_seen_ns"),
            last_seen_ns=node_dict.get("last_seen_ns"),
            duration_ns=node_dict.get("duration_ns"),
        )

    return [dict_to_execution_tree_node(node) for node in dict_tree]


def fetch_profile_data(
    profile_id: str,
    organization_id: int,
    project_id: int,
    start_ts: float | None = None,
    end_ts: float | None = None,
    is_continuous: bool = False,
) -> dict[str, Any] | None:
    """
    Fetch raw profile data from the profiling service.

    Args:
        profile_id: The profile ID to fetch (profile_id for transaction profiles, profiler_id for continuous)
        organization_id: Organization ID
        project_id: Project ID
        start_ts: Start timestamp from span
        end_ts: End timestamp from span
        is_continuous: Whether this is a continuous profile (uses /chunk endpoint)

    Returns:
        Raw profile data or None if not found
    """
    if is_continuous:
        if start_ts is None or end_ts is None:
            logger.info(
                "Start and end timestamps not provided for fetching continuous profiles, skipping",
                extra={
                    "profile_id": profile_id,
                    "is_continuous": is_continuous,
                    "start_ts": start_ts,
                    "end_ts": end_ts,
                },
            )
            return None

        span_start = datetime.fromtimestamp(start_ts, UTC)
        span_end = max(
            datetime.fromtimestamp(end_ts, UTC),
            span_start + timedelta(milliseconds=10),
        )  # Ensure span_end is at least 10ms ahead of span_start
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            logger.warning("Project not found for chunk_ids", extra={"project_id": project_id})
            return None
        span_snuba_params = SnubaParams(
            start=span_start,
            end=span_end,
            projects=[project],
            organization=project.organization,
        )

        chunk_ids = get_chunk_ids(span_snuba_params, profile_id, project_id)

        response = get_from_profiling_service(
            method="POST",
            path=f"/organizations/{organization_id}/projects/{project_id}/chunks",
            json_data={
                "profiler_id": profile_id,
                "chunk_ids": chunk_ids,
                "start": str(int(start_ts * 1e9)),
                "end": str(int(end_ts * 1e9)),
            },
        )
    else:
        # For transaction profiles (profile_id), use the profile endpoint
        response = get_from_profiling_service(
            "GET",
            f"/organizations/{organization_id}/projects/{project_id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

    logger.info(
        "Got response from profiling service",
        extra={
            "profile_id": profile_id,
            "is_continuous": is_continuous,
            "response.status": response.status,
            "response.msg": response.msg,
        },
    )
    if response.status == 200:
        return orjson.loads(response.data)
    return None
