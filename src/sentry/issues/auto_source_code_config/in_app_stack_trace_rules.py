from typing import int
import logging
from collections.abc import Sequence

from sentry.issues.auto_source_code_config.code_mapping import CodeMapping
from sentry.issues.auto_source_code_config.utils.platform import PlatformConfig
from sentry.models.project import Project
from sentry.utils import metrics

from .constants import DERIVED_ENHANCEMENTS_OPTION_KEY, METRIC_PREFIX, STACK_ROOT_MAX_LEVEL

logger = logging.getLogger(__name__)


def save_in_app_stack_trace_rules(
    project: Project, code_mappings: Sequence[CodeMapping], platform_config: PlatformConfig
) -> list[str]:
    """Save in app stack trace rules for a given project"""
    rules_from_code_mappings = set()
    for code_mapping in code_mappings:
        try:
            rules_from_code_mappings.add(generate_rule_for_code_mapping(code_mapping))
        except ValueError:
            pass

    current_enhancements = project.get_option(DERIVED_ENHANCEMENTS_OPTION_KEY)
    current_rules = set(current_enhancements.split("\n")) if current_enhancements else set()

    developer_enhancements = project.get_option("sentry:grouping_enhancements")
    developer_rules = set(developer_enhancements.split("\n")) if developer_enhancements else set()

    # We do not want to duplicate rules from the developer enhancements
    united_rules = rules_from_code_mappings.union(current_rules).difference(developer_rules)

    dry_run = platform_config.is_dry_run_platform(project.organization)
    if not dry_run and united_rules != current_rules:
        project.update_option(DERIVED_ENHANCEMENTS_OPTION_KEY, "\n".join(sorted(united_rules)))

    new_rules_added = united_rules - current_rules
    metrics.incr(
        key=f"{METRIC_PREFIX}.in_app_stack_trace_rules.created",
        amount=len(new_rules_added),
        tags={"platform": platform_config.platform, "dry_run": dry_run},
        sample_rate=1.0,
    )
    return list(new_rules_added)


# XXX: This is very Java specific. If we want to support other languages, we need to
# come up with a better way to generate the rule.
def generate_rule_for_code_mapping(code_mapping: CodeMapping) -> str:
    """Generate an in-app rule for a given code mapping"""
    stacktrace_root = code_mapping.stacktrace_root
    if stacktrace_root == "":
        raise ValueError("Stacktrace root is empty")

    parts = stacktrace_root.rstrip("/").split("/")

    if len(parts) == 0:
        raise ValueError("Module is empty")
    elif len(parts) >= STACK_ROOT_MAX_LEVEL - 1:
        # com/example/foo/ -> com.example.**
        # uk/co/example/foo/ -> uk.co.example.**
        module = ".".join(parts[:-1])
        return f"stack.module:{module}.** +app"
    else:
        # a/ -> a.**
        # x/y/ -> x.y.**
        module = ".".join(parts)
        return f"stack.module:{module}.** +app"
