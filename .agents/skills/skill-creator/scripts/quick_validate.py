# /// script
# requires-python = ">=3.12"
# dependencies = ["pyyaml"]
# ///
"""
Quick validation script for Agent Skills.

Validates SKILL.md frontmatter, naming conventions, and directory structure.

Usage:
    uv run quick_validate.py <skill_directory>

Returns exit code 0 on success, 1 on failure. Outputs JSON with validation results.
"""

import json
import re
import sys
from pathlib import Path

import yaml

MAX_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024
MAX_SKILL_LINES = 500


def validate_skill(skill_path: Path) -> tuple[bool, list[str], list[str]]:
    """Validate a skill directory. Returns (valid, errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []

    # Check SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, ["SKILL.md not found"], []

    content = skill_md.read_text()
    lines = content.splitlines()

    # Check frontmatter exists and is first
    if not content.startswith("---"):
        errors.append("No YAML frontmatter found (file must start with ---)")
        return False, errors, warnings

    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        errors.append("Invalid frontmatter format (missing closing ---)")
        return False, errors, warnings

    # Parse frontmatter
    frontmatter_text = match.group(1)
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            errors.append("Frontmatter must be a YAML mapping")
            return False, errors, warnings
    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML in frontmatter: {e}")
        return False, errors, warnings

    # Validate allowed fields
    allowed_fields = {
        "name", "description", "license", "compatibility",
        "metadata", "allowed-tools",
        # Claude Code extensions
        "argument-hint", "disable-model-invocation", "user-invocable",
        "model", "context", "agent", "hooks",
    }
    unexpected = set(frontmatter.keys()) - allowed_fields
    if unexpected:
        warnings.append(
            f"Unexpected frontmatter field(s): {', '.join(sorted(unexpected))}. "
            f"These may be ignored by some tools."
        )

    # Validate name
    if "name" not in frontmatter:
        errors.append("Missing required field: name")
    else:
        name = frontmatter["name"]
        if not isinstance(name, str):
            errors.append(f"name must be a string, got {type(name).__name__}")
        else:
            name = name.strip()
            if not name:
                errors.append("name must not be empty")
            elif len(name) > MAX_NAME_LENGTH:
                errors.append(
                    f"name is too long ({len(name)} chars, max {MAX_NAME_LENGTH})"
                )
            elif not re.match(r"^[a-z0-9-]+$", name):
                errors.append(
                    f"name '{name}' must contain only lowercase letters, digits, and hyphens"
                )
            elif name.startswith("-") or name.endswith("-"):
                errors.append(f"name '{name}' must not start or end with a hyphen")
            elif "--" in name:
                errors.append(f"name '{name}' must not contain consecutive hyphens")
            elif name != skill_path.name:
                errors.append(
                    f"name '{name}' does not match directory name '{skill_path.name}'"
                )

    # Validate description
    if "description" not in frontmatter:
        errors.append("Missing required field: description")
    else:
        desc = frontmatter["description"]
        if not isinstance(desc, str):
            errors.append(f"description must be a string, got {type(desc).__name__}")
        else:
            desc = desc.strip()
            if not desc:
                errors.append("description must not be empty")
            elif len(desc) > MAX_DESCRIPTION_LENGTH:
                errors.append(
                    f"description is too long ({len(desc)} chars, max {MAX_DESCRIPTION_LENGTH})"
                )
            if "<" in desc or ">" in desc:
                errors.append("description must not contain angle brackets (< or >)")

            # Quality checks
            lower_desc = desc.lower()
            if not any(
                kw in lower_desc
                for kw in ["use when", "use for", "use to", "trigger", "invoke"]
            ):
                warnings.append(
                    "description should include trigger phrases "
                    '(e.g., \'Use when asked to "review code"\')'
                )
            if lower_desc.startswith(("i ", "i can", "you ")):
                warnings.append(
                    "description should be in third person "
                    '("Processes files..." not "I can process files...")'
                )

    # Check line count
    body_start = content.index("---", 3) + 3
    body_lines = content[body_start:].strip().splitlines()
    if len(body_lines) > MAX_SKILL_LINES:
        warnings.append(
            f"SKILL.md body is {len(body_lines)} lines (recommended max {MAX_SKILL_LINES}). "
            "Consider moving content to references/."
        )

    # Check for common issues
    if "references/" in content or "scripts/" in content:
        refs_dir = skill_path / "references"
        scripts_dir = skill_path / "scripts"
        if "references/" in content and not refs_dir.exists():
            errors.append("SKILL.md references 'references/' but directory does not exist")
        if "scripts/" in content and not scripts_dir.exists():
            errors.append("SKILL.md references 'scripts/' but directory does not exist")

    # Check for hardcoded paths (should use ${CLAUDE_SKILL_ROOT})
    if re.search(r"(?:plugins|skills)/[a-z-]+/(?:scripts|references|assets)/", content):
        warnings.append(
            "SKILL.md may contain hardcoded paths. "
            "Use ${CLAUDE_SKILL_ROOT}/scripts/... instead."
        )

    return len(errors) == 0, errors, warnings


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: uv run quick_validate.py <skill_directory>", file=sys.stderr)
        sys.exit(1)

    skill_path = Path(sys.argv[1]).resolve()
    if not skill_path.is_dir():
        print(json.dumps({"valid": False, "errors": [f"Not a directory: {skill_path}"]}))
        sys.exit(1)

    valid, errors, warnings = validate_skill(skill_path)

    result = {"valid": valid, "errors": errors, "warnings": warnings}
    print(json.dumps(result, indent=2))
    sys.exit(0 if valid else 1)


if __name__ == "__main__":
    main()
