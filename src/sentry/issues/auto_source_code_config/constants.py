from __future__ import annotations

from collections.abc import Mapping
from typing import Any

METRIC_PREFIX = "auto_source_code_config"
SUPPORTED_INTEGRATIONS = ["github"]

# Any new languages should also require updating the stacktraceLink.tsx
# The extensions do not need to be exhaustive but only include the ones that show up in stacktraces
PLATFORMS_CONFIG: dict[str, Mapping[str, Any]] = {
    "csharp": {"extensions": ["cs"]},
    "go": {"extensions": ["go"]},
    "java": {
        # e.g. com.foo.bar.Baz$handle$1, Baz.kt -> com/foo/bar/Baz.kt
        "extract_filename_from_module": True,
        "create_in_app_stack_trace_rules": True,
        "dry_run": True,
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
