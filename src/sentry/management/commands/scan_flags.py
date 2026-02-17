"""
Feature Flag Graveyard Cleaner

Scans sentry, getsentry, and sentry-options-automator to find dead, stale,
and misconfigured feature flags.

Usage:
    sentry django scan_flags [--skip-git] [--only dead] [--output report.md]
"""

import os
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from sentry import features

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SENTRY_ROOT = Path(os.environ.get("SENTRY_ROOT", Path.cwd()))
GETSENTRY_ROOT = SENTRY_ROOT.parent / "getsentry"
AUTOMATOR_ROOT = SENTRY_ROOT.parent / "sentry-options-automator"


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class FlagRegistration:
    name: str
    source_type: str  # "temporary" | "permanent" | "getsentry"
    feature_class: str  # "OrganizationFeature" | "ProjectFeature" | "SystemFeature"
    handler_strategy: str  # "FLAGPOLE" | "INTERNAL"
    api_expose: bool
    default: bool


@dataclass
class FlagUsage:
    file: str
    repo: str  # "sentry" | "getsentry" | "sentry-options-automator"
    line: int
    context: str
    usage_type: str  # "code" | "test" | "frontend" | "plan-list" | "early-adopter" | "handler"


@dataclass
class FlagpoleConfig:
    enabled: bool
    created_at: str
    owner_team: str
    owner_email: str
    segments: list
    is_ga: bool
    rollout_summary: str


@dataclass
class FlagReport:
    registration: FlagRegistration
    usages: list[FlagUsage] = field(default_factory=list)
    flagpole: FlagpoleConfig | None = None
    in_plan_lists: list[str] = field(default_factory=list)
    owner: str = ""
    last_code_change: date | None = None
    last_flagpole_change: date | None = None
    status: str = ""


# ---------------------------------------------------------------------------
# Step 1: Enumerate flags from the sentry feature registry
# ---------------------------------------------------------------------------


def _parse_permanent_names(permanent_py_content: str) -> set[str]:
    """Extract flag names from permanent.py file content."""
    names: set[str] = set()
    for match in re.finditer(r'"([^"]+)"\s*:', permanent_py_content):
        name = match.group(1)
        if ":" in name:
            names.add(name)
    return names


def enumerate_flags(
    *,
    all_features: dict[str, type] | None = None,
    flagpole_features: set[str] | None = None,
    exposed_features: set[str] | None = None,
    feature_defaults: dict[str, bool] | None = None,
    permanent_names: set[str] | None = None,
) -> dict[str, FlagReport]:
    """Use the actual sentry feature manager to enumerate all registered flags.

    All parameters are optional — when omitted, values are read from the live
    sentry feature registry and settings.  Pass them explicitly in tests to
    avoid depending on the real registry.
    """
    if all_features is None or flagpole_features is None or exposed_features is None:
        manager = features.default_manager
        if all_features is None:
            all_features = manager.all()
        if flagpole_features is None:
            flagpole_features = manager.flagpole_features
        if exposed_features is None:
            exposed_features = manager.exposed_features

    if feature_defaults is None:
        feature_defaults = settings.SENTRY_FEATURES

    if permanent_names is None:
        permanent_py = SENTRY_ROOT / "src" / "sentry" / "features" / "permanent.py"
        if permanent_py.exists():
            permanent_names = _parse_permanent_names(permanent_py.read_text())
        else:
            permanent_names = set()

    reports: dict[str, FlagReport] = {}

    for name, feature_class in all_features.items():
        source_type = "permanent" if name in permanent_names else "temporary"

        reg = FlagRegistration(
            name=name,
            source_type=source_type,
            feature_class=feature_class.__name__,
            handler_strategy="FLAGPOLE" if name in flagpole_features else "INTERNAL",
            api_expose=name in exposed_features,
            default=feature_defaults.get(name, False),
        )
        reports[name] = FlagReport(registration=reg)

    return reports


class Command(BaseCommand):
    help = "Scan for dead, stale, and misconfigured feature flags"

    def add_arguments(self, parser):
        parser.add_argument("--skip-git", action="store_true", help="Skip git staleness analysis")
        parser.add_argument(
            "--staleness-days",
            type=int,
            default=180,
            help="Days before a flag is considered stale (default: 180)",
        )
        parser.add_argument(
            "--only", type=str, default=None, help="Only show flags with this status"
        )
        parser.add_argument(
            "--output",
            type=str,
            default=str(SENTRY_ROOT / "hackathon" / "flag-cleaner" / "report.md"),
            help="Output path for the markdown report",
        )
        parser.add_argument("--getsentry-path", type=str, default=str(GETSENTRY_ROOT))
        parser.add_argument("--automator-path", type=str, default=str(AUTOMATOR_ROOT))

    def handle(self, **options):
        self.stdout.write("Feature Flag Graveyard Cleaner")
        self.stdout.write("=" * 50)

        # Step 1: Enumerate flags from the registry
        self.stdout.write("\n[Step 1] Enumerating flags from sentry feature registry...")
        reports = enumerate_flags()

        # Print summary
        by_source: dict[str, int] = defaultdict(int)
        by_class: dict[str, int] = defaultdict(int)
        by_strategy: dict[str, int] = defaultdict(int)
        exposed_count = 0
        default_true_count = 0

        for name, report in reports.items():
            reg = report.registration
            by_source[reg.source_type] += 1
            by_class[reg.feature_class] += 1
            by_strategy[reg.handler_strategy] += 1
            if reg.api_expose:
                exposed_count += 1
            if reg.default:
                default_true_count += 1

        self.stdout.write(f"\n  Total flags: {len(reports)}")
        self.stdout.write("\n  By source:")
        for source, count in sorted(by_source.items()):
            self.stdout.write(f"    {source}: {count}")
        self.stdout.write("\n  By type:")
        for cls, count in sorted(by_class.items()):
            self.stdout.write(f"    {cls}: {count}")
        self.stdout.write("\n  By strategy:")
        for strategy, count in sorted(by_strategy.items()):
            self.stdout.write(f"    {strategy}: {count}")
        self.stdout.write(f"\n  API-exposed: {exposed_count}")
        self.stdout.write(f"  default=True: {default_true_count}")

        # Print a few examples
        self.stdout.write("\n  First 10 flags:")
        for name in sorted(reports.keys())[:10]:
            reg = reports[name].registration
            self.stdout.write(
                f"    {name} ({reg.source_type}, {reg.feature_class}, {reg.handler_strategy})"
            )

        self.stdout.write("\n[Step 1 complete. Validate the output above before continuing.]")
