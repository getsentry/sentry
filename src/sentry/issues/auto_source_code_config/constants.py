from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.integrations.types import IntegrationProviderSlug

METRIC_PREFIX = "auto_source_code_config"
DERIVED_ENHANCEMENTS_OPTION_KEY = "sentry:derived_grouping_enhancements"
SUPPORTED_INTEGRATIONS = [IntegrationProviderSlug.GITHUB.value]
STACK_ROOT_MAX_LEVEL = 4

# The extensions do not need to be exhaustive but only include the ones that show up in stacktraces
PLATFORMS_CONFIG: dict[str, Mapping[str, Any]] = {
    # C#, F#, VB, PowerShell, C# Script, F# Script
    "csharp": {"extensions": ["cs", "fs", "vb", "ps1", "csx", "fsx"]},
    "go": {"extensions": ["go"]},
    "java": {
        # e.g. com.foo.bar.Baz$handle$1, Baz.kt -> com/foo/bar/Baz.kt
        "extract_filename_from_module": True,
        "create_in_app_stack_trace_rules": True,
        "extensions": ["kt", "kts", "java", "jsp", "scala", "sc"],
    },
    "javascript": {"extensions": ["js", "jsx", "mjs", "tsx", "ts"]},
    "node": {"extensions": ["js", "jsx", "mjs", "tsx", "ts"]},
    "php": {"extensions": ["php"]},
    "python": {"extensions": ["py"]},
    "ruby": {"extensions": ["rb", "rake"]},
    "clojure": {"extensions": ["clj", "cljs", "cljc"]},
    "groovy": {"extensions": ["groovy"]},
}
