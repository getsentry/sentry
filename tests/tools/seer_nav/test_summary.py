from pathlib import Path

import pytest

from tools.seer_nav.summary import summarize_nav


def _write(root: Path, rel: str, content: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


@pytest.fixture
def frontend_dir(tmp_path: Path) -> Path:
    _write(
        tmp_path,
        "views/navigation/navigation.tsx",
        "export function PrimaryNavigationItems() {\n"
        "  const hasSeer = organization.features.includes('seer-primary-nav');\n"
        "  // organization.features.includes('commented-out-flag')\n"
        "}\n",
    )
    _write(
        tmp_path,
        "views/navigation/secondary/content.tsx",
        "if (hasFeature('dashboards-starred')) {}\n",
    )
    _write(
        tmp_path,
        "views/navigation/secondary/sections/explore/exploreSecondaryNavigation.tsx",
        "{t('Explore')}\n"
        "<Feature features={['ourlogs-enabled', 'tracemetrics-enabled']}>{t('Logs')}</Feature>\n",
    )
    _write(tmp_path, "views/navigation/secondary/sections/issues/index.tsx", "{t('Issues')}\n")
    _write(tmp_path, "views/navigation/secondary/sections/settings/settings.tsx", "{t('Nope')}\n")
    _write(
        tmp_path,
        "views/dashboards/utils/prebuiltConfigs/ai/settings.ts",
        "export const AI_AGENTS_OVERVIEW_DASHBOARD_TITLE = t('AI Agents Overview');\n"
        "const description = t('Some long descriptive sentence about agents');\n",
    )
    _write(
        tmp_path,
        "views/dashboards/utils/prebuiltConfigs/mobileVitals/settings.ts",
        "export const APP_STARTS_DASHBOARD_TITLE = t('Mobile Vitals App Starts');\n",
    )
    _write(
        tmp_path,
        "views/explore/tables/index.tsx",
        "<TabList.Item>{t('Attribute Breakdowns')}</TabList.Item>\n"
        "<TabList.Item>{t('Aggregates')}</TabList.Item>\n"
        "const hint = t('Editing columns is available for span samples only');\n",
    )
    return tmp_path


def test_summarize_nav(frontend_dir: Path) -> None:
    assert summarize_nav(str(frontend_dir)) == {
        # A section dir without a SecondaryNavigation or index file is left out.
        "sections": {"explore": ["Explore", "Logs"], "issues": ["Issues"]},
        # Only `*_TITLE` constants, not other t(...) strings.
        "prebuilt_dashboards": ["AI Agents Overview", "Mobile Vitals App Starts"],
        # Full-sentence strings are filtered out by the word-count guard.
        "explore_tabs": ["Attribute Breakdowns", "Aggregates"],
        # Commented-out references are ignored.
        "flags": [
            "dashboards-starred",
            "ourlogs-enabled",
            "seer-primary-nav",
            "tracemetrics-enabled",
        ],
    }


def test_missing_source_fails(frontend_dir: Path) -> None:
    (frontend_dir / "views/explore/tables/index.tsx").unlink()
    with pytest.raises(SystemExit, match="explore_tabs not found"):
        summarize_nav(str(frontend_dir))


def test_missing_primary_nav_fails(frontend_dir: Path) -> None:
    (frontend_dir / "views/navigation/navigation.tsx").unlink()
    with pytest.raises(SystemExit, match="primary nav not found"):
        summarize_nav(str(frontend_dir))
