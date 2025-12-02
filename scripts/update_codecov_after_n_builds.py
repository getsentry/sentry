#!/usr/bin/env python3
# flake8: noqa
"""
Script to automatically update after_n_builds values in codecov.yml based on
GitHub Actions workflow matrix configurations.

This script:
1. Parses GitHub Actions workflow files to find matrix instances
2. Calculates the correct after_n_builds values for each flag
3. Updates the codecov.yml file with the correct values
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml


def count_matrix_instances(workflow_path: Path, job_name: str) -> int:
    """
    Count the number of matrix instances for a given job in a workflow file.

    Returns the count of matrix instances or 1 if no matrix is found.
    """
    with open(workflow_path) as f:
        workflow = yaml.safe_load(f)

    if "jobs" not in workflow or job_name not in workflow["jobs"]:
        return 0

    job = workflow["jobs"][job_name]

    # Check if job has a matrix strategy
    if "strategy" in job and "matrix" in job["strategy"]:
        matrix = job["strategy"]["matrix"]
        # The instance field contains the list of matrix instances
        if "instance" in matrix:
            instances = matrix["instance"]
            if isinstance(instances, list):
                return len(instances)

    # No matrix found, single instance
    return 1


def discover_workflow_jobs(workflows_dir: Path) -> dict[str, dict]:
    """
    Automatically discover which workflow and job corresponds to each codecov flag.

    This function searches through all workflow files looking for jobs that upload
    codecov artifacts with a specific type (e.g., type: backend, type: frontend).

    Returns a dict mapping flag names to their workflow and job configuration.
    """
    flag_configs = {}

    # Iterate through all workflow files
    for workflow_file in workflows_dir.glob("*.yml"):
        try:
            with open(workflow_file) as f:
                workflow = yaml.safe_load(f)

            if "jobs" not in workflow:
                continue

            # Search each job for codecov artifact uploads
            for job_name, job_config in workflow["jobs"].items():
                if not isinstance(job_config, dict) or "steps" not in job_config:
                    continue

                # Look through steps for artifact/codecov uploads
                for step in job_config["steps"]:
                    if not isinstance(step, dict):
                        continue

                    # Check if this step uses the artifacts action
                    uses = step.get("uses", "")
                    if "artifacts" in uses and "with" in step:
                        # Extract the type parameter which indicates the codecov flag
                        codecov_type = step["with"].get("type")
                        if codecov_type:
                            flag_configs[codecov_type] = {
                                "workflow": workflow_file.name,
                                "job": job_name,
                            }
        except Exception as e:
            # Skip files that can't be parsed
            print(f"Warning: Could not parse {workflow_file.name}: {e}", file=sys.stderr)
            continue

    return flag_configs


def update_codecov_yml(repo_root: Path, dry_run: bool = False) -> bool:
    """
    Update the after_n_builds values in codecov.yml.

    Returns True if changes were made, False otherwise.
    """
    workflows_dir = repo_root / ".github" / "workflows"
    codecov_yml_path = repo_root / "codecov.yml"

    if not codecov_yml_path.exists():
        print(f"Error: {codecov_yml_path} not found", file=sys.stderr)
        return False

    # Discover which workflow and job corresponds to each codecov flag
    print("Discovering workflows and jobs from GitHub Actions...")
    config = discover_workflow_jobs(workflows_dir)

    if not config:
        print("Error: No codecov uploads found in workflow files", file=sys.stderr)
        return False

    print(f"Found {len(config)} codecov flags:")
    for flag_name, flag_config in config.items():
        print(f"  - {flag_name}: {flag_config['workflow']} ({flag_config['job']})")
    print()

    # Calculate the correct values for each flag
    flag_values = {}
    for flag_name, flag_config in config.items():
        workflow_path = workflows_dir / flag_config["workflow"]
        if not workflow_path.exists():
            print(f"Warning: Workflow {workflow_path} not found", file=sys.stderr)
            continue

        count = count_matrix_instances(workflow_path, flag_config["job"])
        if count == 0:
            print(
                f"Warning: Job {flag_config['job']} not found in {workflow_path}", file=sys.stderr
            )
            continue

        flag_values[flag_name] = count
        print(f"  {flag_name}: {count} builds")

    # Calculate the total for the comment section
    total = sum(flag_values.values())
    print(f"  comment.after_n_builds (total): {total} builds")

    # Read the current codecov.yml
    with open(codecov_yml_path) as f:
        content = f.read()

    original_content = content

    # Update each flag's after_n_builds value
    for flag_name, new_value in flag_values.items():
        # Find the flag section and update its after_n_builds value
        # Pattern matches the flag name followed by any content, then after_n_builds with a number
        # Using minimal matching to stop at the first after_n_builds in this flag's section
        flag_pattern = rf"(^  {re.escape(flag_name)}:$.*?^\s+after_n_builds:\s+)(\d+)"
        match = re.search(flag_pattern, content, re.MULTILINE | re.DOTALL)

        if match:
            old_num = int(match.group(2))
            if old_num != new_value:
                print(f"  Updating {flag_name}: {old_num} -> {new_value}")
                content = re.sub(
                    flag_pattern,
                    rf"\g<1>{new_value}",
                    content,
                    count=1,
                    flags=re.MULTILINE | re.DOTALL,
                )
            else:
                print(f"  {flag_name} is already correct ({old_num})")
        else:
            print(f"Warning: Could not find {flag_name} section in codecov.yml", file=sys.stderr)

    # Update the comment section's after_n_builds
    comment_pattern = r"(^comment:$.*?^\s+after_n_builds:\s+)(\d+)"
    match = re.search(comment_pattern, content, re.MULTILINE | re.DOTALL)

    if match:
        old_num = int(match.group(2))
        if old_num != total:
            print(f"  Updating comment.after_n_builds: {old_num} -> {total}")
            content = re.sub(
                comment_pattern,
                rf"\g<1>{total}",
                content,
                count=1,
                flags=re.MULTILINE | re.DOTALL,
            )
        else:
            print(f"  comment.after_n_builds is already correct ({old_num})")
    else:
        print("Warning: Could not find comment section in codecov.yml", file=sys.stderr)

    # Write the updated content back if changes were made
    if content != original_content:
        if dry_run:
            print("\nDry run - changes not written to file")
            print("\nDiff:")
            print("=" * 80)
            # Simple diff
            for i, (old_line, new_line) in enumerate(
                zip(original_content.splitlines(), content.splitlines()), 1
            ):
                if old_line != new_line:
                    print(f"Line {i}:")
                    print(f"  - {old_line}")
                    print(f"  + {new_line}")
            print("=" * 80)
        else:
            with open(codecov_yml_path, "w") as f:
                f.write(content)
            print(f"\nSuccessfully updated {codecov_yml_path}")
        return True
    else:
        print("\nNo changes needed - all values are already correct")
        return False


def main() -> int:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Update after_n_builds values in codecov.yml based on GitHub Actions workflows"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without actually modifying files",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).parent.parent,
        help="Path to the repository root (default: parent of script directory)",
    )

    args = parser.parse_args()

    print("Calculating after_n_builds values from GitHub Actions workflows:")
    print("=" * 80)

    try:
        changes_made = update_codecov_yml(args.repo_root, args.dry_run)
        return 0 if not args.dry_run else (1 if changes_made else 0)
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
