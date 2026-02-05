#!/usr/bin/env python3
"""
Classify backend tests by their service requirements (tier).

Tiers:
- tier1: DB-only tests (postgres, redis) - ~83% of tests
- tier2: Snuba tests (postgres, redis, kafka, clickhouse, snuba) - ~17% of tests
- tier3: Full stack tests (includes symbolicator) - <1% of tests

Classification is based on:
1. Test file path (tests/snuba/* -> tier2, tests/symbolicator/* -> tier3)
2. Base class inheritance (SnubaTestCase -> tier2)
3. Markers (@requires_snuba, @requires_kafka, @requires_symbolicator)
"""

import argparse
import re
import sys
from pathlib import Path

# Patterns that indicate Snuba requirement
SNUBA_PATTERNS = [
    r"SnubaTestCase",
    r"BaseMetricsLayerTestCase",
    r"MetricsEnhancedPerformanceTestCase",
    r"ProfilesSnubaTestCase",
    r"ReplaysSnubaTestCase",
    r"OutcomesSnubaTest",
    r"@requires_snuba",
    r"requires_snuba",
    r"@pytest\.mark\.snuba",
]

# Patterns that indicate Kafka requirement (subset of Snuba tests)
KAFKA_PATTERNS = [
    r"@requires_kafka",
    r"requires_kafka",
]

# Patterns that indicate Symbolicator requirement
SYMBOLICATOR_PATTERNS = [
    r"@requires_symbolicator",
    r"requires_symbolicator",
]

# Directories that implicitly require certain services
SNUBA_DIRS = [
    "tests/snuba/",
    "tests/relay_integration/",
    "tests/integration/",
]

SYMBOLICATOR_DIRS = [
    "tests/symbolicator/",
]


def check_file_for_patterns(file_path: Path, patterns: list[str]) -> bool:
    """Check if a file contains any of the given patterns."""
    try:
        content = file_path.read_text()
        for pattern in patterns:
            if re.search(pattern, content):
                return True
    except Exception:
        pass
    return False


def classify_test_file(file_path: Path, repo_root: Path) -> str:
    """
    Classify a test file into a tier.

    Returns: 'tier1', 'tier2', or 'tier3'
    """
    rel_path = str(file_path.relative_to(repo_root))

    # Check directory-based classification first
    for dir_pattern in SYMBOLICATOR_DIRS:
        if rel_path.startswith(dir_pattern):
            return "tier3"

    for dir_pattern in SNUBA_DIRS:
        if rel_path.startswith(dir_pattern):
            return "tier2"

    # Check file content for patterns
    if check_file_for_patterns(file_path, SYMBOLICATOR_PATTERNS):
        return "tier3"

    if check_file_for_patterns(file_path, SNUBA_PATTERNS):
        return "tier2"

    # Default to tier1 (DB-only)
    return "tier1"


def find_test_files(tests_dir: Path) -> list[Path]:
    """Find all Python test files in the tests directory."""
    test_files = []
    exclude_dirs = {"acceptance", "apidocs", "js", "tools", "__pycache__"}

    for path in tests_dir.rglob("test_*.py"):
        # Skip excluded directories
        if any(excluded in path.parts for excluded in exclude_dirs):
            continue
        test_files.append(path)

    return sorted(test_files)


def classify_all_tests(repo_root: Path) -> dict[str, list[str]]:
    """Classify all test files into tiers."""
    tests_dir = repo_root / "tests"
    test_files = find_test_files(tests_dir)

    tiers = {"tier1": [], "tier2": [], "tier3": []}

    for file_path in test_files:
        tier = classify_test_file(file_path, repo_root)
        rel_path = str(file_path.relative_to(repo_root))
        tiers[tier].append(rel_path)

    return tiers


def main():
    parser = argparse.ArgumentParser(description="Classify backend tests by tier")
    parser.add_argument(
        "--tier",
        choices=["tier1", "tier2", "tier3", "all"],
        default="all",
        help="Output only files for a specific tier",
    )
    parser.add_argument(
        "--format",
        choices=["list", "json", "summary"],
        default="summary",
        help="Output format",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output file path (default: stdout)",
    )
    args = parser.parse_args()

    # Find repo root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent.parent.parent
    if not (repo_root / "tests").exists():
        repo_root = Path.cwd()
        if not (repo_root / "tests").exists():
            print("Error: Could not find tests directory", file=sys.stderr)
            sys.exit(1)

    tiers = classify_all_tests(repo_root)

    output_lines = []

    if args.format == "summary":
        total = sum(len(files) for files in tiers.values())
        output_lines.append("Test Classification Summary")
        output_lines.append("=" * 40)
        output_lines.append(f"Total test files: {total}")
        output_lines.append("")
        for tier, files in tiers.items():
            pct = len(files) / total * 100 if total > 0 else 0
            output_lines.append(f"{tier}: {len(files)} files ({pct:.1f}%)")
    elif args.format == "json":
        import json

        output_lines.append(json.dumps(tiers, indent=2))
    elif args.format == "list":
        if args.tier == "all":
            for tier, files in tiers.items():
                output_lines.append(f"# {tier}")
                output_lines.extend(files)
                output_lines.append("")
        else:
            output_lines.extend(tiers.get(args.tier, []))

    output = "\n".join(output_lines)

    if args.output:
        Path(args.output).write_text(output)
        print(f"Output written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
