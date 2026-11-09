import json  # noqa: S003

import pytest

from sentry.apidocs.response_coverage import (
    BASELINE_PATH,
    DOCS,
    REPO_ROOT,
    SPEC_PATH,
    find_violations,
    has_field_sources,
    load_baseline,
)


def test_response_fields_are_described_and_typed() -> None:
    """New response fields need a description and a type; see `response_coverage`."""
    if not SPEC_PATH.exists():
        pytest.fail(f"{SPEC_PATH} is missing; build it with `make build-api-docs`")
    spec = json.loads(SPEC_PATH.read_text())
    assert has_field_sources(spec), f"{SPEC_PATH} is stale; rebuild it with `make build-api-docs`"

    violations = find_violations(spec)
    baseline = load_baseline()
    baseline_file = BASELINE_PATH.relative_to(REPO_ROOT)
    problems = []
    if new := sorted(violations - baseline):
        problems.append(
            f"{len(new)} response fields need a description or a type. Describe a TypedDict "
            'field with `Annotated[T, ApiDescription("...")]` and a serializer field with '
            "`help_text`. Replace `Any` and `dict[str, Any]` with a TypedDict or a concrete "
            f"type. See {DOCS}.\n" + "\n".join(f"  {entry}" for entry in new)
        )
    if fixed := sorted(baseline - violations):
        problems.append(
            f"{len(fixed)} entries in {baseline_file} are fixed; please remove them from the "
            "baseline with `python -m sentry.apidocs.response_coverage --prune`.\n"
            + "\n".join(f"  {entry}" for entry in fixed)
        )
    assert not problems, "\n\n".join(problems)
