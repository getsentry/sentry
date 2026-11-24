from __future__ import annotations

from tools.api_guidelines.owners import UNOWNED, owner_for

PATH = "src/sentry/api/endpoints/example.py"
OWNER_MAP = {PATH: {"ExampleEndpoint": "issues-feed", "OtherEndpoint": "ingest"}}


def test_method_on_the_endpoint_class_uses_that_class() -> None:
    assert owner_for(PATH, "ExampleEndpoint.get", None, OWNER_MAP) == "issues-feed"


def test_helper_on_the_endpoint_class_uses_that_class() -> None:
    # the scope's class wins over the caller's
    assert (
        owner_for(PATH, "OtherEndpoint.filter_things", "ExampleEndpoint.get", OWNER_MAP) == "ingest"
    )


def test_module_level_helper_uses_the_caller() -> None:
    assert owner_for(PATH, "build_query", "ExampleEndpoint.get", OWNER_MAP) == "issues-feed"


def test_base_class_helper_not_in_the_map_uses_the_caller() -> None:
    assert owner_for(PATH, "Base._filters", "OtherEndpoint.get", OWNER_MAP) == "ingest"


def test_nothing_found_is_unowned() -> None:
    assert owner_for(PATH, "build_query", None, OWNER_MAP) == UNOWNED
    assert owner_for(PATH, "Base._filters", "Missing.get", OWNER_MAP) == UNOWNED


def test_a_file_missing_from_the_map_is_unowned() -> None:
    assert owner_for("src/sentry/other.py", "ExampleEndpoint.get", None, OWNER_MAP) == UNOWNED
