from __future__ import annotations

from difflib import unified_diff

from sentry.backup.dependencies import (
    DependenciesJSONEncoder,
    dependencies,
    get_model_name,
    sorted_dependencies,
)
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json

encoder = DependenciesJSONEncoder(
    sort_keys=True,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=2,
    encoding="utf-8",
)


def json_lines(json_obj: object) -> list[str]:
    return encoder.encode(json_obj).splitlines()


def json_diff(expect: object, actual: object) -> list[str]:
    return list(
        unified_diff(
            json_lines(expect),
            json_lines(actual),
            n=3,
        )
    )


def assert_model_dependencies(expect: object, actual: object) -> None:
    diff = json_diff(expect, actual)
    if diff:
        raise AssertionError(
            "Model dependency graph does not match fixture. This means that you have changed the model dependency graph in some load bearing way. If you are seeing this in CI, and the dependency changes are intentional, please run `bin/generate-model-dependency-fixtures` and re-upload:\n\n"
            + "\n".join(diff)
        )


def test_detailed():
    fixture_path = get_fixture_path("backup", "model_dependencies", "detailed.json")
    with open(fixture_path) as fixture:
        expect = json.load(fixture)

    actual = {str(k): v for k, v in dependencies().items()}
    assert_model_dependencies(expect, actual)


def test_flat():
    fixture_path = get_fixture_path("backup", "model_dependencies", "flat.json")
    with open(fixture_path) as fixture:
        expect = json.load(fixture)

    actual = {str(k): v.flatten() for k, v in dependencies().items()}
    assert_model_dependencies(expect, actual)


def test_sorted():
    fixture_path = get_fixture_path("backup", "model_dependencies", "sorted.json")
    with open(fixture_path) as fixture:
        expect = json.load(fixture)

    actual = sorted_dependencies()
    assert_model_dependencies(expect, actual)


def test_truncate():
    fixture_path = get_fixture_path("backup", "model_dependencies", "truncate.json")
    with open(fixture_path) as fixture:
        expect = json.load(fixture)

    actual = [dependencies()[get_model_name(m)].table_name for m in sorted_dependencies()]
    assert_model_dependencies(expect, actual)
