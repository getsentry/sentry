from typing import int
"""Generate readable diffs showing thread creation locations for debugging leaks."""

import sys
from collections.abc import Generator, Iterable
from threading import Thread
from traceback import FrameSummary, StackSummary

from ._constants import HERE
from ._threading import get_thread_function_name


def get_relevant_frames(stack: Iterable[FrameSummary]) -> StackSummary:
    """Filter stack frames to show only test and testutil code relevant for debugging.

    Applies a series of filters to remove stdlib and system code, then focuses on
    test and testutil frames where thread leak fixes typically need to go. Each filter
    is only applied if it doesn't remove all frames.
    """
    # Get stdlib directory path if available (for filtering system code)
    stdlib_dir = getattr(sys, "_stdlib_dir", None)

    # Apply each filter independently, reverting if it would remove all frames
    for filter in (
        lambda frame: frame.filename.startswith(HERE),  # Remove thread leak detection frames
        lambda frame: frame.line is None,  # Remove "frozen" stdlib modules
        lambda frame: stdlib_dir
        and frame.filename.startswith(stdlib_dir + "/"),  # Remove Python stdlib
        lambda frame: frame.filename.startswith(sys.prefix),  # Remove system Python files
        # Keep only test/testutil frames (where fixes will need to go)
        lambda frame: "/test_" not in frame.filename,  # NOTE: filter-not is a double negative
        lambda frame: "/testutils/" not in frame.filename,
    ):
        filtered_stack = [frame for frame in stack if not filter(frame)]
        # Only apply the filter if it leaves some frames (fail-safe)
        if filtered_stack:
            stack = StackSummary.from_list(filtered_stack)

    return StackSummary.from_list(stack)


def _threads_to_diffable(threads: list[Thread]) -> list[str]:
    """Convert threads to string representations suitable for diffing.

    Each thread becomes a formatted string containing:
    - Thread representation (name, ID, daemon status)
    - Target function fully qualified name
    - Indented stack trace showing where thread was created

    Threads are sorted by ID for consistent diff output.
    """
    result: list[str] = []
    for thread in sorted(threads, key=lambda t: t.ident or 0):
        func_fqname = get_thread_function_name(thread)
        stack = getattr(thread, "_where", [])
        stack = get_relevant_frames(stack)
        stack = "".join(stack.format())
        # Indent stack trace lines for visual hierarchy in diff output
        stack = ("\n" + stack).replace("\n", "\n  ").strip(" ")
        result.append(f"{thread!r}@{func_fqname}{stack}\n")
    return result


def _diff(old: list[str], new: list[str]) -> Generator[str]:
    """Generate unified diff lines between two thread lists."""
    import difflib

    matcher = difflib.SequenceMatcher(None, old, new)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        for tags, threads, prefix in [
            (("equal",), old[i1:i2], " "),
            (("delete", "replace"), old[i1:i2], "-"),
            (("insert", "replace"), new[j1:j2], "+"),
        ]:
            if tag in tags:
                for thread_str in threads:
                    for line in thread_str.splitlines():
                        yield f"{prefix} {line}\n"


def diff(old: list[Thread], new: list[Thread]) -> str:
    """Generate unambiguous unified diff from structured thread data."""
    return "\n" + "".join(
        _diff(
            _threads_to_diffable(old),
            _threads_to_diffable(new),
        )
    )
