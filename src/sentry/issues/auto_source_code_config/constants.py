from __future__ import annotations

from collections.abc import Mapping
from typing import Any

METRIC_PREFIX = "auto_source_code_config"
DERIVED_ENHANCEMENTS_OPTION_KEY = "sentry:derived_grouping_enhancements"
SUPPORTED_INTEGRATIONS = ["github"]
STACK_ROOT_MAX_LEVEL = 3
# Stacktrace roots that match one of these will have three levels of granularity
# com.au, co.uk, org.uk, gov.uk, net.uk, edu.uk, ct.uk
# This list does not have to be exhaustive as the fallback is two levels of granularity
SECOND_LEVEL_TLDS = ("com", "co", "org", "gov", "net", "edu")

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


# This list needs to be updated when new packages are added to the list
UNINTENDED_RULES = [
    "stack.module:akka.** +app",
    "stack.module:com.fasterxml.** +app",
    "stack.module:com.microsoft.** +app",
    "stack.module:com.sun.** +app",
    "stack.module:feign.** +app",
    "stack.module:io.opentelemetry.** +app",
    "stack.module:jdk.** +app",
    "stack.module:oauth.** +app",
    "stack.module:org.apache.** +app",
    "stack.module:org.glassfish.** +app",
    "stack.module:org.jboss.** +app",
    "stack.module:org.jdesktop.** +app",
    "stack.module:org.postgresql.** +app",
    "stack.module:org.springframework.** +app",
    "stack.module:org.web3j.** +app",
    "stack.module:reactor.core.** +app",
    "stack.module:scala.** +app",
    "stack.module:sun.** +app",
]
