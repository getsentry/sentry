from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.integrations.types import IntegrationProviderSlug

METRIC_PREFIX = "auto_source_code_config"
DERIVED_ENHANCEMENTS_OPTION_KEY = "sentry:derived_grouping_enhancements"
SUPPORTED_INTEGRATIONS = [IntegrationProviderSlug.GITHUB.value]
STACK_ROOT_MAX_LEVEL = 4
# Stacktrace roots that match one of these will have three levels of granularity
# com.au, co.uk, org.uk, gov.uk, net.uk, edu.uk, ct.uk
# This list does not have to be exhaustive as the fallback is two levels of granularity
SECOND_LEVEL_TLDS = ("com", "co", "org", "gov", "net", "edu")

# Any new languages should also require updating the stacktraceLink.tsx
# The extensions do not need to be exhaustive but only include the ones that show up in stacktraces
PLATFORMS_CONFIG: dict[str, Mapping[str, Any]] = {
    # C#, F#, VB, PowerShell, C# Script, F# Script
    "csharp": {"extensions": ["cs", "fs", "vb", "ps1", "csx", "fsx"]},
    "go": {"extensions": ["go"]},
    "java": {
        # e.g. com.foo.bar.Baz$handle$1, Baz.kt -> com/foo/bar/Baz.kt
        "extract_filename_from_module": True,
        "create_in_app_stack_trace_rules": True,
        "extensions": ["kt", "kts", "java", "jsp"],
    },
    "javascript": {"extensions": ["js", "jsx", "mjs", "tsx", "ts"]},
    "node": {"extensions": ["js", "jsx", "mjs", "tsx", "ts"]},
    "php": {"extensions": ["php"]},
    "python": {"extensions": ["py"]},
    "ruby": {"extensions": ["rb", "rake"]},
    "scala": {"extensions": ["scala", "sc"]},
    "clojure": {"extensions": ["clj", "cljs", "cljc"]},
    "groovy": {"extensions": ["groovy"]},
}
