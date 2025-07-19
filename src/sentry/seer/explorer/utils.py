import re

from sentry.seer.autofix.autofix import _convert_profile_to_execution_tree
from sentry.seer.explorer.models import ExecutionTreeNode


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


def convert_profile_to_execution_tree(profile_data: dict) -> list[ExecutionTreeNode]:
    """
    Converts profile data into a hierarchical representation of code execution,
    including only items from the MainThread and app frames.
    Calculates accurate durations for all nodes based on call stack transitions.
    """
    # Use the autofix implementation to get dict-based results
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
