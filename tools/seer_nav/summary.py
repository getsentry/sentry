"""Summarize Sentry's nav for Seer: section items, Sentry-built dashboards, Explore tabs and
the feature flags the nav files reference.

Only runs when regenerating the snapshot (see generate_snapshot), never per request.
"""

from __future__ import annotations

import os
import re
from typing import TypedDict

from tools.seer_nav.parser import _read_source

_NAV_LABEL_RE = re.compile(r"""\bt\(['"]([\w][\w /-]*)['"]\)""")
# Sentry-built dashboard titles are `*_TITLE = t('...')` constants, not in the nav files.
_DASHBOARD_TITLE_RE = re.compile(r"""[A-Z_]*TITLE[A-Z_]*\s*=\s*t\(['"]([^'"]+)['"]\)""")
_FLAG_INCLUDES_RE = re.compile(r"""features?\.includes\(\s*['"]([^'"]+)['"]\s*\)""")
_HAS_FEATURE_RE = re.compile(r"""hasFeature\(\s*['"]([^'"]+)['"]\s*\)""")
_FEATURE_COMPONENT_RE = re.compile(r"""features=\{\[([^\]]+)\]\}""")
_QUOTED_IN_ARRAY_RE = re.compile(r"""['"]([a-z][a-z0-9-]{2,})['"]""")

_PRIMARY_NAV = "views/navigation/navigation.tsx"
_SECONDARY_NAV = "views/navigation/secondary/content.tsx"
_SECTIONS_DIR = "views/navigation/secondary/sections"
_PREBUILT_DASHBOARDS_DIR = "views/dashboards/utils/prebuiltConfigs"
_EXPLORE_TABLES = "views/explore/tables/index.tsx"


class NavSummary(TypedDict):
    # Section directory name to its labels, the section header first.
    sections: dict[str, list[str]]
    # Reached via Dashboards → Sentry Built, not the sidebar.
    prebuilt_dashboards: list[str]
    # Tabs inside the Explore → Traces view, not the sidebar.
    explore_tabs: list[str]
    flags: list[str]


def _section_sources(frontend_dir: str) -> dict[str, str]:
    root = os.path.join(frontend_dir, _SECTIONS_DIR)
    sources: dict[str, str] = {}
    for section in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        base = f"{_SECTIONS_DIR}/{section}"
        for rel in (f"{base}/{section}SecondaryNavigation.tsx", f"{base}/index.tsx"):
            content = _read_source(frontend_dir, rel)
            if content is not None:
                sources[section] = content
                break
    return sources


def _prebuilt_dashboards(frontend_dir: str) -> list[str]:
    root = os.path.join(frontend_dir, _PREBUILT_DASHBOARDS_DIR)
    titles: set[str] = set()
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if name.endswith(".ts"):
                rel = os.path.relpath(os.path.join(dirpath, name), frontend_dir)
                titles.update(_DASHBOARD_TITLE_RE.findall(_read_source(frontend_dir, rel) or ""))
    return sorted(titles)


def _explore_tabs(frontend_dir: str) -> list[str]:
    labels = _NAV_LABEL_RE.findall(_read_source(frontend_dir, _EXPLORE_TABLES) or "")
    # Tab labels are short; the file's other t(...) strings are full sentences.
    return list(dict.fromkeys(label for label in labels if len(label.split()) <= 3))


def _flag_refs(content: str) -> set[str]:
    refs = {*_FLAG_INCLUDES_RE.findall(content), *_HAS_FEATURE_RE.findall(content)}
    for array_body in _FEATURE_COMPONENT_RE.findall(content):
        refs.update(_QUOTED_IN_ARRAY_RE.findall(array_body))
    return refs


def summarize_nav(frontend_dir: str) -> NavSummary:
    sections = _section_sources(frontend_dir)
    nav_sources = [
        _read_source(frontend_dir, _PRIMARY_NAV),
        _read_source(frontend_dir, _SECONDARY_NAV),
    ]
    summary = NavSummary(
        sections={
            section: labels
            for section, content in sections.items()
            if (labels := _NAV_LABEL_RE.findall(content))
        },
        prebuilt_dashboards=_prebuilt_dashboards(frontend_dir),
        explore_tabs=_explore_tabs(frontend_dir),
        flags=sorted(_flag_refs("".join([*(s or "" for s in nav_sources), *sections.values()]))),
    )
    missing = [key for key, value in summary.items() if not value]
    if missing or None in nav_sources:
        raise SystemExit(
            f"Could not summarize the nav ({', '.join(missing) or 'primary nav'} not found); "
            "the frontend layout may have changed."
        )
    return summary
