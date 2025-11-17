#!/usr/bin/env python3
"""
SVG Path Precision Optimizer

This script optimizes the numeric precision in SVG path data within TSX icon files.
It only modifies numbers inside the 'd' attribute of <path> elements within <SvgIcon> components.
"""

import argparse
import difflib
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional


def round_number(num_str: str, precision: int) -> str:
    """
    Round a number to the specified precision.

    Args:
        num_str: String containing the number
        precision: Number of decimal places to preserve

    Returns:
        Rounded number as string
    """
    # Check if the original number started with a decimal point (like .35)
    starts_with_decimal = (
        num_str.startswith(".") or num_str.startswith("+.") or num_str.startswith("-.")
    )

    try:
        num = float(num_str)

        # Round to specified precision
        if precision == 0:
            rounded = str(int(round(num)))
        else:
            rounded = f"{num:.{precision}f}"
            # Remove trailing zeros after decimal point
            if "." in rounded:
                rounded = rounded.rstrip("0").rstrip(".")

        # Preserve the original format: if it started with a decimal point, remove the leading 0
        if starts_with_decimal and rounded.startswith("0."):
            rounded = rounded[1:]  # Remove the leading '0'
        elif starts_with_decimal and rounded.startswith("-0."):
            rounded = "-" + rounded[2:]  # Keep the sign, remove the '0'

        return rounded
    except ValueError:
        # If we can't parse it, return original
        return num_str


def optimize_path_precision(path_data: str, precision: int) -> str:
    """
    Optimize the precision of numbers in an SVG path data string.

    Args:
        path_data: SVG path data string (the 'd' attribute value)
        precision: Number of decimal places to preserve

    Returns:
        Optimized path data string
    """
    # Pattern to match numbers in SVG paths
    # This pattern matches: optional sign, optional digits, optional decimal point and digits
    number_pattern = r"[-+]?(?:\d+\.?\d*|\d*\.\d+)(?:[eE][-+]?\d+)?"

    result = []
    last_end = 0

    for match in re.finditer(number_pattern, path_data):
        # Add the text between last match and current match
        result.append(path_data[last_end : match.start()])

        # Round the number
        rounded = round_number(match.group(0), precision)
        result.append(rounded)

        # Check if we need to add a space after this number
        # This is needed when: the rounded number ends with a digit,
        # and the next character is a digit or decimal point (would create ambiguity)
        if match.end() < len(path_data):
            next_char = path_data[match.end()]
            if rounded and rounded[-1].isdigit() and next_char in "0123456789.":
                result.append(" ")

        last_end = match.end()

    # Add any remaining text after the last match
    result.append(path_data[last_end:])

    return "".join(result)


def process_tsx_file(file_path: Path, precision: int, dry_run: bool = False) -> str | None:
    """
    Process a TSX icon file and optimize SVG path precision.

    Args:
        file_path: Path to the TSX file
        precision: Number of decimal places to preserve
        dry_run: If True, return modified content without writing

    Returns:
        Modified content if dry_run is True, None otherwise
    """
    with open(file_path, encoding="utf-8") as f:
        content = f.read()

    # Pattern to match path elements with 'd' attribute
    # This matches: <path d="..." /> or <path d="...">
    path_pattern = r'(<path[^>]*d=")([^"]+)(")'

    def replace_path(match: re.Match) -> str:
        prefix = match.group(1)
        path_data = match.group(2)
        suffix = match.group(3)

        optimized_path = optimize_path_precision(path_data, precision)
        return prefix + optimized_path + suffix

    modified_content = re.sub(path_pattern, replace_path, content)

    if dry_run:
        return modified_content
    else:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(modified_content)
        return None


def show_diff_with_difflib(
    original_path: Path, original_content: str, modified_content: str
) -> None:
    """
    Show diff between original and modified content using Python's difflib (no temp files).

    Args:
        original_path: Path to the original file (for display purposes)
        original_content: Original file content
        modified_content: Modified file content
    """
    original_lines = original_content.splitlines(keepends=True)
    modified_lines = modified_content.splitlines(keepends=True)

    # Generate unified diff
    diff = difflib.unified_diff(
        original_lines,
        modified_lines,
        fromfile=f"a/{original_path.name}",
        tofile=f"b/{original_path.name}",
        lineterm="",
    )

    # Print diff with colors if possible
    has_changes = False
    for line in diff:
        has_changes = True
        # Color output if terminal supports it
        if sys.stdout.isatty():
            if line.startswith("+++") or line.startswith("---"):
                print(f"\033[1m{line}\033[0m")  # Bold
            elif line.startswith("+"):
                print(f"\033[32m{line}\033[0m")  # Green
            elif line.startswith("-"):
                print(f"\033[31m{line}\033[0m")  # Red
            elif line.startswith("@@"):
                print(f"\033[36m{line}\033[0m")  # Cyan
            else:
                print(line)
        else:
            print(line)

    if not has_changes:
        print(f"No changes in {original_path}")


def show_diff_with_difft(original_path: Path, modified_content: str) -> None:
    """
    Show diff between original file and modified content using difftastic.
    Note: This requires writing a temporary file to disk.

    Args:
        original_path: Path to the original file
        modified_content: Modified file content
    """
    # Create a temporary file with the modified content
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".tsx", delete=False, encoding="utf-8"
    ) as tmp_file:
        tmp_file.write(modified_content)
        tmp_path = tmp_file.name

    try:
        # Run difft to show the diff
        result = subprocess.run(
            ["difft", "--display", "side-by-side", str(original_path), tmp_path],
            capture_output=False,
            text=True,
        )

        if result.returncode != 0 and result.returncode != 1:
            # difft returns 1 when there are differences, which is expected
            print(f"Warning: difft exited with code {result.returncode}", file=sys.stderr)
    finally:
        # Clean up temporary file
        os.unlink(tmp_path)


def main():
    parser = argparse.ArgumentParser(
        description="Optimize SVG path precision in TSX icon files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Optimize a single file with 2 decimal places (dry run, no temp files)
  %(prog)s --precision 2 --dry static/app/icons/iconCircle.tsx

  # Dry run using difftastic for nicer diff output (writes temp files)
  %(prog)s --precision 2 --dry --use-difft static/app/icons/iconCircle.tsx

  # Optimize all icon files with 3 decimal places
  %(prog)s --precision 3 static/app/icons/*.tsx

  # Optimize with 1 decimal place (actual modification)
  %(prog)s --precision 1 static/app/icons/iconSettings.tsx
        """,
    )

    parser.add_argument("files", nargs="+", type=Path, help="TSX icon files to process")

    parser.add_argument(
        "--precision",
        type=int,
        required=True,
        help="Number of decimal places to preserve (e.g., 2 for 0.12, 3 for 0.123)",
    )

    parser.add_argument(
        "--dry",
        action="store_true",
        help="Dry run mode: show diff without modifying files (uses built-in diff by default)",
    )

    parser.add_argument(
        "--use-difft",
        action="store_true",
        help="Use difftastic for diffs (requires writing temp files to disk). Only applies with --dry.",
    )

    args = parser.parse_args()

    if args.precision < 0:
        print("Error: precision must be non-negative", file=sys.stderr)
        sys.exit(1)

    # Check if difft is available when requested
    use_difft = args.dry and args.use_difft
    if use_difft:
        try:
            subprocess.run(["difft", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Error: difftastic (difft) not found. Please install it first.", file=sys.stderr)
            print("Installation: brew install difftastic", file=sys.stderr)
            print("Note: The default built-in diff does not require difftastic.", file=sys.stderr)
            sys.exit(1)

    # Process each file
    for file_path in args.files:
        if not file_path.exists():
            print(f"Warning: File not found: {file_path}", file=sys.stderr)
            continue

        if not file_path.suffix == ".tsx":
            print(f"Warning: Skipping non-TSX file: {file_path}", file=sys.stderr)
            continue

        print(f"\nProcessing: {file_path}")

        if args.dry:
            # Read original content
            with open(file_path, encoding="utf-8") as f:
                original_content = f.read()

            modified_content = process_tsx_file(file_path, args.precision, dry_run=True)
            if modified_content:
                if args.use_difft:
                    # Use difftastic (requires temp file)
                    show_diff_with_difft(file_path, modified_content)
                else:
                    # Use built-in diff (no temp files) - DEFAULT
                    show_diff_with_difflib(file_path, original_content, modified_content)
        else:
            process_tsx_file(file_path, args.precision, dry_run=False)
            print(f"✓ Optimized: {file_path}")

    if not args.dry:
        print(f"\n✓ All files processed with precision={args.precision}")
    else:
        print(f"\n✓ Dry run complete (no files modified)")


if __name__ == "__main__":
    main()
