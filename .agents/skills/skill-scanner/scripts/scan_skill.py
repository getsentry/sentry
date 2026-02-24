#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["pyyaml"]
# ///
"""
Static analysis scanner for agent skills.

Scans a skill directory for security issues including prompt injection patterns,
obfuscation, dangerous code, secrets, and excessive permissions.

Usage:
    uv run scan_skill.py <skill-directory>

Output: JSON to stdout with structured findings.
"""
from __future__ import annotations

import base64
import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml


# --- Pattern Definitions ---

PROMPT_INJECTION_PATTERNS: list[tuple[str, str, str]] = [
    # (pattern, description, severity)
    (r"(?i)ignore\s+(all\s+)?previous\s+instructions", "Instruction override: ignore previous instructions", "critical"),
    (r"(?i)disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|guidelines)", "Instruction override: disregard previous", "critical"),
    (r"(?i)forget\s+(all\s+)?(previous|prior|your)\s+(instructions|rules|training)", "Instruction override: forget previous", "critical"),
    (r"(?i)you\s+are\s+now\s+(a|an|in)\s+", "Role reassignment: 'you are now'", "high"),
    (r"(?i)act\s+as\s+(a|an)\s+unrestricted", "Role reassignment: unrestricted mode", "critical"),
    (r"(?i)enter\s+(developer|debug|admin|god)\s+mode", "Jailbreak: developer/debug mode", "critical"),
    (r"(?i)DAN\s+(mode|prompt|jailbreak)", "Jailbreak: DAN pattern", "critical"),
    (r"(?i)do\s+anything\s+now", "Jailbreak: do anything now", "critical"),
    (r"(?i)bypass\s+(safety|security|content|filter|restriction)", "Jailbreak: bypass safety", "critical"),
    (r"(?i)override\s+(system|safety|security)\s+(prompt|message|instruction)", "System prompt override", "critical"),
    (r"(?i)\bsystem\s*:\s*you\s+are\b", "System prompt injection marker", "high"),
    (r"(?i)new\s+system\s+(prompt|instruction|message)\s*:", "New system prompt injection", "critical"),
    (r"(?i)from\s+now\s+on,?\s+(you|ignore|forget|disregard)", "Temporal instruction override", "high"),
    (r"(?i)pretend\s+(that\s+)?you\s+(have\s+no|don't\s+have|are\s+not\s+bound)", "Pretend-based jailbreak", "high"),
    (r"(?i)respond\s+(only\s+)?with\s+(the\s+)?(raw|full|complete)\s+(system|initial)\s+prompt", "System prompt extraction", "high"),
    (r"(?i)output\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions)", "System prompt extraction", "high"),
]

OBFUSCATION_PATTERNS: list[tuple[str, str]] = [
    # (description, detail)
    ("Zero-width characters", "Zero-width space, joiner, or non-joiner detected"),
    ("Right-to-left override", "RTL override character can hide text direction"),
    ("Homoglyph characters", "Characters visually similar to ASCII but from different Unicode blocks"),
]

SECRET_PATTERNS: list[tuple[str, str, str]] = [
    # (pattern, description, severity)
    (r"(?i)AKIA[0-9A-Z]{16}", "AWS Access Key ID", "critical"),
    (r"(?i)aws.{0,20}secret.{0,20}['\"][0-9a-zA-Z/+]{40}['\"]", "AWS Secret Access Key", "critical"),
    (r"ghp_[0-9a-zA-Z]{36}", "GitHub Personal Access Token", "critical"),
    (r"ghs_[0-9a-zA-Z]{36}", "GitHub Server Token", "critical"),
    (r"gho_[0-9a-zA-Z]{36}", "GitHub OAuth Token", "critical"),
    (r"github_pat_[0-9a-zA-Z_]{82}", "GitHub Fine-Grained PAT", "critical"),
    (r"sk-[0-9a-zA-Z]{20,}T3BlbkFJ[0-9a-zA-Z]{20,}", "OpenAI API Key", "critical"),
    (r"sk-ant-api03-[0-9a-zA-Z\-_]{90,}", "Anthropic API Key", "critical"),
    (r"xox[bpors]-[0-9a-zA-Z\-]{10,}", "Slack Token", "critical"),
    (r"-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----", "Private Key", "critical"),
    (r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{8,}['\"]", "Hardcoded password", "high"),
    (r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"][0-9a-zA-Z]{16,}['\"]", "Hardcoded API key", "high"),
    (r"(?i)(secret|token)\s*[:=]\s*['\"][0-9a-zA-Z]{16,}['\"]", "Hardcoded secret/token", "high"),
]

DANGEROUS_SCRIPT_PATTERNS: list[tuple[str, str, str]] = [
    # (pattern, description, severity)
    # Data exfiltration
    (r"(?i)(requests\.(get|post|put)|urllib\.request|http\.client|aiohttp)\s*\(", "HTTP request (potential exfiltration)", "medium"),
    (r"(?i)(curl|wget)\s+", "Shell HTTP request", "medium"),
    (r"(?i)socket\.(connect|create_connection)", "Raw socket connection", "high"),
    (r"(?i)subprocess.*\b(nc|ncat|netcat)\b", "Netcat usage (potential reverse shell)", "critical"),
    # Credential access
    (r"(?i)(~|HOME|USERPROFILE).*\.(ssh|aws|gnupg|config)", "Sensitive directory access", "high"),
    (r"(?i)open\s*\(.*(\.env|credentials|\.netrc|\.pgpass|\.my\.cnf)", "Sensitive file access", "high"),
    (r"(?i)os\.environ\s*\[.*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)", "Environment secret access", "medium"),
    # Dangerous execution
    (r"\beval\s*\(", "eval() usage", "high"),
    (r"\bexec\s*\(", "exec() usage", "high"),
    (r"(?i)subprocess.*shell\s*=\s*True", "Shell execution with shell=True", "high"),
    (r"(?i)os\.(system|popen|exec[lv]p?e?)\s*\(", "OS command execution", "high"),
    (r"(?i)__import__\s*\(", "Dynamic import", "medium"),
    # File system manipulation
    (r"(?i)(open|write|Path).*\.(claude|bashrc|zshrc|profile|bash_profile)", "Agent/shell config modification", "critical"),
    (r"(?i)(open|write|Path).*(settings\.json|CLAUDE\.md|MEMORY\.md|\.mcp\.json)", "Agent settings modification", "critical"),
    (r"(?i)(open|write|Path).*(\.git/hooks|\.husky)", "Git hooks modification", "critical"),
    # Encoding/obfuscation in scripts
    (r"(?i)base64\.(b64decode|decodebytes)\s*\(", "Base64 decoding (potential obfuscation)", "medium"),
    (r"(?i)codecs\.(decode|encode)\s*\(.*rot", "ROT encoding (obfuscation)", "high"),
    (r"(?i)compile\s*\(.*exec", "Dynamic code compilation", "high"),
]

# Domains commonly trusted in skill contexts
TRUSTED_DOMAINS = {
    "github.com", "api.github.com", "raw.githubusercontent.com",
    "docs.sentry.io", "develop.sentry.dev", "sentry.io",
    "pypi.org", "npmjs.com", "crates.io",
    "docs.python.org", "docs.djangoproject.com",
    "developer.mozilla.org", "stackoverflow.com",
    "agentskills.io",
}


def parse_frontmatter(content: str) -> tuple[dict[str, Any] | None, str]:
    """Parse YAML frontmatter from SKILL.md content."""
    if not content.startswith("---"):
        return None, content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return None, content

    try:
        fm = yaml.safe_load(parts[1])
        body = parts[2]
        return fm if isinstance(fm, dict) else None, body
    except yaml.YAMLError:
        return None, content


def check_frontmatter(skill_dir: Path, content: str) -> list[dict[str, Any]]:
    """Validate SKILL.md frontmatter."""
    findings: list[dict[str, Any]] = []
    fm, _ = parse_frontmatter(content)

    if fm is None:
        findings.append({
            "type": "Invalid Frontmatter",
            "severity": "high",
            "location": "SKILL.md:1",
            "description": "Missing or unparseable YAML frontmatter",
            "category": "Validation",
        })
        return findings

    # Required fields
    if "name" not in fm:
        findings.append({
            "type": "Missing Name",
            "severity": "high",
            "location": "SKILL.md frontmatter",
            "description": "Required 'name' field missing from frontmatter",
            "category": "Validation",
        })

    if "description" not in fm:
        findings.append({
            "type": "Missing Description",
            "severity": "medium",
            "location": "SKILL.md frontmatter",
            "description": "Required 'description' field missing from frontmatter",
            "category": "Validation",
        })

    # Name-directory mismatch
    if "name" in fm and fm["name"] != skill_dir.name:
        findings.append({
            "type": "Name Mismatch",
            "severity": "medium",
            "location": "SKILL.md frontmatter",
            "description": f"Frontmatter name '{fm['name']}' does not match directory name '{skill_dir.name}'",
            "category": "Validation",
        })

    # Unrestricted tools
    tools = fm.get("allowed-tools", "")
    if isinstance(tools, str) and tools.strip() == "*":
        findings.append({
            "type": "Unrestricted Tools",
            "severity": "critical",
            "location": "SKILL.md frontmatter",
            "description": "allowed-tools is set to '*' (unrestricted access to all tools)",
            "category": "Excessive Permissions",
        })

    return findings


def check_prompt_injection(content: str, filepath: str) -> list[dict[str, Any]]:
    """Scan content for prompt injection patterns."""
    findings: list[dict[str, Any]] = []
    lines = content.split("\n")

    for line_num, line in enumerate(lines, 1):
        for pattern, description, severity in PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, line):
                findings.append({
                    "type": "Prompt Injection Pattern",
                    "severity": severity,
                    "location": f"{filepath}:{line_num}",
                    "description": description,
                    "evidence": line.strip()[:200],
                    "category": "Prompt Injection",
                })
                break  # One finding per line

    return findings


def check_obfuscation(content: str, filepath: str) -> list[dict[str, Any]]:
    """Detect obfuscation techniques."""
    findings: list[dict[str, Any]] = []
    lines = content.split("\n")

    # Zero-width characters
    zwc_pattern = re.compile(r"[\u200b\u200c\u200d\u2060\ufeff]")
    for line_num, line in enumerate(lines, 1):
        if zwc_pattern.search(line):
            chars = [f"U+{ord(c):04X}" for c in zwc_pattern.findall(line)]
            findings.append({
                "type": "Zero-Width Characters",
                "severity": "high",
                "location": f"{filepath}:{line_num}",
                "description": f"Zero-width characters detected: {', '.join(chars)}",
                "category": "Obfuscation",
            })

    # RTL override
    rtl_pattern = re.compile(r"[\u202a-\u202e\u2066-\u2069]")
    for line_num, line in enumerate(lines, 1):
        if rtl_pattern.search(line):
            findings.append({
                "type": "RTL Override",
                "severity": "high",
                "location": f"{filepath}:{line_num}",
                "description": "Right-to-left override or embedding character detected",
                "category": "Obfuscation",
            })

    # Suspicious base64 strings (long base64 that decodes to text with suspicious keywords)
    b64_pattern = re.compile(r"[A-Za-z0-9+/]{40,}={0,2}")
    for line_num, line in enumerate(lines, 1):
        for match in b64_pattern.finditer(line):
            try:
                decoded = base64.b64decode(match.group()).decode("utf-8", errors="ignore")
                suspicious_keywords = ["ignore", "system", "override", "eval", "exec", "password", "secret"]
                for kw in suspicious_keywords:
                    if kw.lower() in decoded.lower():
                        findings.append({
                            "type": "Suspicious Base64",
                            "severity": "high",
                            "location": f"{filepath}:{line_num}",
                            "description": f"Base64 string decodes to text containing '{kw}'",
                            "decoded_preview": decoded[:100],
                            "category": "Obfuscation",
                        })
                        break
            except Exception:
                pass

    # HTML comments with suspicious content
    comment_pattern = re.compile(r"<!--(.*?)-->", re.DOTALL)
    for match in comment_pattern.finditer(content):
        comment_text = match.group(1)
        # Check if the comment contains injection-like patterns
        for pattern, description, severity in PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, comment_text):
                # Find line number
                line_num = content[:match.start()].count("\n") + 1
                findings.append({
                    "type": "Hidden Injection in Comment",
                    "severity": "critical",
                    "location": f"{filepath}:{line_num}",
                    "description": f"HTML comment contains injection pattern: {description}",
                    "evidence": comment_text.strip()[:200],
                    "category": "Prompt Injection",
                })
                break

    return findings


def check_secrets(content: str, filepath: str) -> list[dict[str, Any]]:
    """Detect hardcoded secrets."""
    findings: list[dict[str, Any]] = []
    lines = content.split("\n")

    for line_num, line in enumerate(lines, 1):
        for pattern, description, severity in SECRET_PATTERNS:
            if re.search(pattern, line):
                # Mask the actual secret in evidence
                evidence = line.strip()[:200]
                findings.append({
                    "type": "Secret Detected",
                    "severity": severity,
                    "location": f"{filepath}:{line_num}",
                    "description": description,
                    "evidence": evidence,
                    "category": "Secret Exposure",
                })
                break  # One finding per line

    return findings


def check_scripts(script_path: Path) -> list[dict[str, Any]]:
    """Analyze a script file for dangerous patterns."""
    findings: list[dict[str, Any]] = []
    try:
        content = script_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return findings

    relative = script_path.name
    lines = content.split("\n")

    for line_num, line in enumerate(lines, 1):
        for pattern, description, severity in DANGEROUS_SCRIPT_PATTERNS:
            if re.search(pattern, line):
                findings.append({
                    "type": "Dangerous Code Pattern",
                    "severity": severity,
                    "location": f"scripts/{relative}:{line_num}",
                    "description": description,
                    "evidence": line.strip()[:200],
                    "category": "Malicious Code",
                })
                break  # One finding per line

    return findings


def extract_urls(content: str, filepath: str) -> list[dict[str, Any]]:
    """Extract and categorize URLs."""
    urls: list[dict[str, Any]] = []
    url_pattern = re.compile(r"https?://[^\s\)\]\>\"'`]+")
    lines = content.split("\n")

    for line_num, line in enumerate(lines, 1):
        for match in url_pattern.finditer(line):
            url = match.group().rstrip(".,;:")
            try:
                # Extract domain
                domain = url.split("//", 1)[1].split("/", 1)[0].split(":")[0]
                # Check if root domain is trusted
                domain_parts = domain.split(".")
                root_domain = ".".join(domain_parts[-2:]) if len(domain_parts) >= 2 else domain
                trusted = root_domain in TRUSTED_DOMAINS or domain in TRUSTED_DOMAINS
            except (IndexError, ValueError):
                domain = "unknown"
                trusted = False

            urls.append({
                "url": url,
                "domain": domain,
                "trusted": trusted,
                "location": f"{filepath}:{line_num}",
            })

    return urls


def compute_description_body_overlap(frontmatter: dict[str, Any] | None, body: str) -> float:
    """Compute keyword overlap between description and body as a heuristic."""
    if not frontmatter or "description" not in frontmatter or frontmatter["description"] is None:
        return 0.0

    desc_words = set(re.findall(r"\b[a-z]{4,}\b", frontmatter["description"].lower()))
    body_words = set(re.findall(r"\b[a-z]{4,}\b", body.lower()))

    if not desc_words:
        return 0.0

    overlap = desc_words & body_words
    return len(overlap) / len(desc_words)


def scan_skill(skill_dir: Path) -> dict[str, Any]:
    """Run full scan on a skill directory."""
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return {"error": f"No SKILL.md found in {skill_dir}"}

    try:
        content = skill_md.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return {"error": f"Cannot read SKILL.md: {e}"}

    frontmatter, body = parse_frontmatter(content)

    all_findings: list[dict[str, Any]] = []
    all_urls: list[dict[str, Any]] = []

    # 1. Frontmatter validation
    all_findings.extend(check_frontmatter(skill_dir, content))

    # 2. Prompt injection patterns in SKILL.md
    all_findings.extend(check_prompt_injection(content, "SKILL.md"))

    # 3. Obfuscation detection in SKILL.md
    all_findings.extend(check_obfuscation(content, "SKILL.md"))

    # 4. Secret detection in SKILL.md
    all_findings.extend(check_secrets(content, "SKILL.md"))

    # 5. URL extraction from SKILL.md
    all_urls.extend(extract_urls(content, "SKILL.md"))

    # 6. Scan reference files
    refs_dir = skill_dir / "references"
    if refs_dir.is_dir():
        for ref_file in sorted(refs_dir.iterdir()):
            if ref_file.suffix == ".md":
                try:
                    ref_content = ref_file.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                rel_path = f"references/{ref_file.name}"
                all_findings.extend(check_prompt_injection(ref_content, rel_path))
                all_findings.extend(check_obfuscation(ref_content, rel_path))
                all_findings.extend(check_secrets(ref_content, rel_path))
                all_urls.extend(extract_urls(ref_content, rel_path))

    # 7. Scan scripts
    scripts_dir = skill_dir / "scripts"
    script_findings: list[dict[str, Any]] = []
    if scripts_dir.is_dir():
        for script_file in sorted(scripts_dir.iterdir()):
            if script_file.suffix in (".py", ".sh", ".js", ".ts"):
                sf = check_scripts(script_file)
                script_findings.extend(sf)
                try:
                    script_content = script_file.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                rel_path = f"scripts/{script_file.name}"
                all_findings.extend(check_secrets(script_content, rel_path))
                all_findings.extend(check_obfuscation(script_content, rel_path))
                all_urls.extend(extract_urls(script_content, rel_path))

    all_findings.extend(script_findings)

    # 8. Description-body overlap
    overlap = compute_description_body_overlap(frontmatter, body)

    # Build structure info
    structure = {
        "has_skill_md": True,
        "has_references": refs_dir.is_dir() if (refs_dir := skill_dir / "references") else False,
        "has_scripts": scripts_dir.is_dir() if (scripts_dir := skill_dir / "scripts") else False,
        "reference_files": sorted(f.name for f in (skill_dir / "references").iterdir() if f.suffix == ".md") if (skill_dir / "references").is_dir() else [],
        "script_files": sorted(f.name for f in (skill_dir / "scripts").iterdir() if f.suffix in (".py", ".sh", ".js", ".ts")) if (skill_dir / "scripts").is_dir() else [],
    }

    # Summary counts
    severity_counts: dict[str, int] = {}
    for f in all_findings:
        sev = f.get("severity", "unknown")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    untrusted_urls = [u for u in all_urls if not u["trusted"]]

    # Allowed tools analysis
    tools_info = None
    if frontmatter and "allowed-tools" in frontmatter:
        tools_str = frontmatter["allowed-tools"]
        if isinstance(tools_str, str):
            tools_list = [t.strip() for t in tools_str.replace(",", " ").split() if t.strip()]
            tools_info = {
                "tools": tools_list,
                "has_bash": "Bash" in tools_list,
                "has_write": "Write" in tools_list,
                "has_edit": "Edit" in tools_list,
                "has_webfetch": "WebFetch" in tools_list,
                "has_task": "Task" in tools_list,
                "unrestricted": tools_str.strip() == "*",
            }

    return {
        "skill_name": frontmatter.get("name", "unknown") if frontmatter else "unknown",
        "skill_dir": str(skill_dir),
        "structure": structure,
        "frontmatter": frontmatter,
        "tools": tools_info,
        "findings": all_findings,
        "finding_counts": severity_counts,
        "total_findings": len(all_findings),
        "urls": {
            "total": len(all_urls),
            "untrusted": untrusted_urls,
            "trusted_count": len(all_urls) - len(untrusted_urls),
        },
        "description_body_overlap": round(overlap, 2),
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: scan_skill.py <skill-directory>", file=sys.stderr)
        sys.exit(1)

    skill_dir = Path(sys.argv[1]).resolve()
    if not skill_dir.is_dir():
        print(json.dumps({"error": f"Not a directory: {skill_dir}"}))
        sys.exit(1)

    result = scan_skill(skill_dir)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
