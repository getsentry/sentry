from difflib import unified_diff

from sentry.backup.dependencies import DependenciesJSONEncoder, dependencies, sorted_dependencies
from sentry.testutils.factories import get_fixture_path

encoder = DependenciesJSONEncoder(
    sort_keys=True,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=2,
    encoding="utf-8",
)


def test_detailed():
    fixture_path = get_fixture_path("backup", "model_dependencies", "detailed.json")
    with open(fixture_path) as fixture:
        expect = fixture.read().splitlines()

    actual = encoder.encode(dependencies()).splitlines()
    diff = list(unified_diff(expect, actual, n=3))
    if diff:
        raise AssertionError(
            "Model dependency graph does not match fixture. If you are seeing this in CI, please run `bin/generate-model-dependency-fixtures` and re-upload:\n\n"
            + "\n".join(diff)
        )


def test_flat():
    fixture_path = get_fixture_path("backup", "model_dependencies", "flat.json")
    with open(fixture_path) as fixture:
        expect = fixture.read().splitlines()

    actual = encoder.encode({k: v.flatten() for k, v in dependencies().items()}).splitlines()
    diff = list(unified_diff(expect, actual, n=3))
    if diff:
        raise AssertionError(
            "Model dependency graph does not match fixture. If you are seeing this in CI, please run `bin/generate-model-dependency-fixtures` and re-upload:\n\n"
            + "\n".join(diff)
        )


def test_sorted():
    fixture_path = get_fixture_path("backup", "model_dependencies", "sorted.json")
    with open(fixture_path) as fixture:
        expect = fixture.read().splitlines()

    actual = encoder.encode(sorted_dependencies()).splitlines()
    diff = list(unified_diff(expect, actual, n=3))
    if diff:
        raise AssertionError(
            "Model dependency list does not match fixture. If you are seeing this in CI, please run `bin/generate-model-dependency-fixtures` and re-upload:\n\n"
            + "\n".join(diff)
        )
