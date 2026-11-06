from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import TypedDict

from sentry.integrations.types import IntegrationProviderSlug

from .utils.java import find_java_source_roots

METRIC_PREFIX = "auto_source_code_config"
DERIVED_ENHANCEMENTS_OPTION_KEY = "sentry:derived_grouping_enhancements"
SUPPORTED_INTEGRATIONS = [
    IntegrationProviderSlug.GITHUB.value,
    IntegrationProviderSlug.CURSOR_ORIGIN.value,
]
STACK_ROOT_MAX_LEVEL = 4

SourceRootsResolver = Callable[[str, Sequence[str] | None], tuple[str, str] | None]


class PlatformConfigDict(TypedDict, total=False):
    extensions: Sequence[str]
    dry_run: bool
    extract_filename_from_module: bool
    create_in_app_stack_trace_rules: bool
    source_roots_resolver: SourceRootsResolver


# The extensions do not need to be exhaustive but only include the ones that show up in stacktraces
PLATFORMS_CONFIG: dict[str, PlatformConfigDict] = {
    # C#, F#, VB, PowerShell, C# Script, F# Script
    "csharp": {"extensions": ["cs", "fs", "vb", "ps1", "csx", "fsx"]},
    "go": {"extensions": ["go"]},
    "java": {
        # e.g. com.foo.bar.Baz$handle$1, Baz.kt -> com/foo/bar/Baz.kt
        "extract_filename_from_module": True,
        "create_in_app_stack_trace_rules": True,
        "source_roots_resolver": find_java_source_roots,
        "extensions": ["kt", "kts", "java", "jsp", "scala", "sc"],
    },
    "javascript": {"extensions": ["js", "jsx", "mjs", "tsx", "ts", "cjs", "mts", "cts"]},
    "node": {"extensions": ["js", "jsx", "mjs", "tsx", "ts", "cjs", "mts", "cts"]},
    "php": {"extensions": ["php"]},
    "python": {"extensions": ["py"]},
    "ruby": {"extensions": ["rb", "rake"]},
    "clojure": {"extensions": ["clj", "cljs", "cljc"]},
    "groovy": {"extensions": ["groovy"]},
}
