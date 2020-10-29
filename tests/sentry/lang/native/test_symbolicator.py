from __future__ import absolute_import

import pytest

from sentry.lang.native.symbolicator import get_sources_for_project
from sentry.testutils.helpers import Feature
from sentry.utils.compat import map


CUSTOM_SOURCE_CONFIG = """
[{
    "type": "http",
    "id": "custom",
    "layout": {"type": "symstore"},
    "url": "https://msdl.microsoft.com/download/symbols/"
}]
"""


@pytest.mark.django_db
def test_sources_no_feature(default_project):
    features = {"organizations:symbol-sources": False, "organizations:custom-symbol-sources": False}

    with Feature(features):
        sources = get_sources_for_project(default_project)

    assert len(sources) == 1
    assert sources[0]["type"] == "sentry"
    assert sources[0]["id"] == "sentry:project"


@pytest.mark.django_db
def test_sources_builtin(default_project):
    features = {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["microsoft"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    # XXX: The order matters here! Project is always first, then builtin sources
    source_ids = map(lambda s: s["id"], sources)
    assert source_ids == ["sentry:project", "sentry:microsoft"]


# Test that a builtin source that is not declared in SENTRY_BUILTIN_SOURCES does
# not lead to an error. It should simply be ignored.
@pytest.mark.django_db
def test_sources_builtin_unknown(default_project):
    features = {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["invalid"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = map(lambda s: s["id"], sources)
    assert source_ids == ["sentry:project"]


# Test that previously saved builtin sources are not returned if the feature for
# builtin sources is missing at query time.
@pytest.mark.django_db
def test_sources_builtin_disabled(default_project):
    features = {"organizations:symbol-sources": False, "organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["microsoft"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = map(lambda s: s["id"], sources)
    assert source_ids == ["sentry:project"]


@pytest.mark.django_db
def test_sources_custom(default_project):
    features = {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": True}

    # Remove builtin sources explicitly to avoid defaults
    default_project.update_option("sentry:builtin_symbol_sources", [])
    default_project.update_option("sentry:symbol_sources", CUSTOM_SOURCE_CONFIG)

    with Feature(features):
        sources = get_sources_for_project(default_project)

    # XXX: The order matters here! Project is always first, then custom sources
    source_ids = map(lambda s: s["id"], sources)
    assert source_ids == ["sentry:project", "custom"]


# Test that previously saved custom sources are not returned if the feature for
# custom sources is missing at query time.
@pytest.mark.django_db
def test_sources_custom_disabled(default_project):
    features = {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", [])
    default_project.update_option("sentry:symbol_sources", CUSTOM_SOURCE_CONFIG)

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = map(lambda s: s["id"], sources)
    assert source_ids == ["sentry:project"]
