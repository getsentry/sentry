from pathlib import Path
from unittest import mock

import pytest

from tools.seer_nav import parser
from tools.seer_nav.entries import Condition
from tools.seer_nav.parser import (
    _js_condition,
    _parse_route_tree,
    check_alias_sources,
    parse_nav_entries,
)

EXPLORE_NAV = """
const hasNewErrors = organization.features.includes('explore-errors');
export function ExploreSecondaryNavigation() {
  const baseUrl = `/organizations/${organization.slug}/explore`;
  return (
    <SecondaryNavigation.Header>
      <SecondaryNavigation.HeaderTitle>{t('Explore')}</SecondaryNavigation.HeaderTitle>
    </SecondaryNavigation.Header>
    <Feature features="ourlogs-enabled">
      <SecondaryNavigation.Link to={`${baseUrl}/logs/`}>{t('Logs')}</SecondaryNavigation.Link>
    </Feature>
    {/* Used to be wrapped in <Feature features="old-traces-flag"> before GA */}
    <SecondaryNavigation.Link docs="https://docs.sentry.io/" to={`${baseUrl}/traces/`}>{t('Traces')}</SecondaryNavigation.Link>
    {!hasNewErrors && (
      <SecondaryNavigation.Link to={`${baseUrl}/errors/`}>{t('Errors')}</SecondaryNavigation.Link>
    )}
    {hasBeta && (
      <Fragment>
        <Text>{t('Beta pages')}</Text>
        <SecondaryNavigation.Link to={`${baseUrl}/beta/`}>{t('Beta')}</SecondaryNavigation.Link>
      </Fragment>
    )}
    <SecondaryNavigation.Link to={`${baseUrl}/releases/`}>{t('Releases')}</SecondaryNavigation.Link>
    {hasNewHome ? (
      <SecondaryNavigation.Link to={`${baseUrl}/home/`}>{t('Home')}</SecondaryNavigation.Link>
    ) : (
      <SecondaryNavigation.Link to={`${baseUrl}/classic/`}>{t('Classic')}</SecondaryNavigation.Link>
    )}
    {hasPreview ? (
      <SecondaryNavigation.Link to={`${baseUrl}/preview/`}>{t('Preview')}</SecondaryNavigation.Link>
    ) : null}
    <SecondaryNavigation.Link to={`${baseUrl}/saved/`}>{t('Saved')}</SecondaryNavigation.Link>
    {organization.openMembership && (
      <Feature features="organizations:investigations">
        <SecondaryNavigation.Link to={`${baseUrl}/investigations/`}>{t('Investigations')}</SecondaryNavigation.Link>
      </Feature>
    )}
  );
}
"""

ORG_SETTINGS = """
const organizationSettingsPathPrefix = '/settings';
export function getUserOrgNavigationConfiguration() {
  return [
    {
      name: t('Organization'),
      items: [
        {path: `${organizationSettingsPathPrefix}/`, title: settingsV3 ? t('General') : t('General Settings')},
        {path: `${organizationSettingsPathPrefix}/teams/`, title: t('Teams')},
        {path: `${organizationSettingsPathPrefix}/early-features/`, title: t('Early Features'), show: ({isSelfHosted}) => isSelfHosted || false},
        {path: `${organizationSettingsPathPrefix}/old/`, title: t('Old'), show: false, // deprecated
        },
        {
          path: `${organizationSettingsPathPrefix}/seer/repos/`,
          title: t('Code Review'),
          show: ({organization}) =>
            !!organization &&
            (organization.features.includes('a') || organization.features.includes('b')),
        },
      ],
    },
  ];
}
"""


BILLING_SETTINGS = """
function buildBillingNavigationConfig(organization, membersCanViewSubscriptionInfo) {
  const prefix = '/settings/:orgId';

  const items = [
    {
      path: `${prefix}/billing/`,
      title: t('Subscription'),
      show: ({access}: NavProps) => access?.has('org:billing') || membersCanViewSubscriptionInfo,
    },
    {
      path: `${prefix}/subscription/spend-allocations/`,
      title: t('Spend Allocations'),
      show: () => organization.features.includes('spend-allocations'),
    },
    {path: `${prefix}/legal/`, title: t('Legal & Compliance')},
  ];

  return {name: t('Usage & Billing'), items};
}
"""


def _write(root: Path, rel: str, content: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


@pytest.fixture
def frontend_dir(tmp_path: Path) -> str:
    _write(
        tmp_path,
        "views/navigation/secondary/sections/explore/exploreSecondaryNavigation.tsx",
        EXPLORE_NAV,
    )
    _write(tmp_path, "views/settings/organization/userOrgNavigationConfiguration.tsx", ORG_SETTINGS)
    return str(tmp_path)


def test_secondary_nav_records_flag_negation_and_org_conditions(frontend_dir: str) -> None:
    entries = {e.crumbs: (e.path, e.when) for e in parse_nav_entries(frontend_dir)}
    assert entries["Explore → Logs"] == ("/explore/logs/", {"flag": "ourlogs-enabled"})
    assert entries["Explore → Errors"] == ("/explore/errors/", {"not": {"flag": "explore-errors"}})
    assert entries["Explore → Investigations"] == (
        "/explore/investigations/",
        {"all": [{"flag": "investigations"}, {"org": "openMembership"}]},
    )


def test_commented_out_gates_are_ignored(frontend_dir: str) -> None:
    entries = {e.crumbs: e.when for e in parse_nav_entries(frontend_dir)}
    assert entries["Explore → Traces"] is None


def test_ternary_branches_get_the_condition_and_its_negation(frontend_dir: str) -> None:
    entries = {e.crumbs: e.when for e in parse_nav_entries(frontend_dir)}
    assert entries["Explore → Home"] == {"unknown": "hasNewHome"}
    assert entries["Explore → Classic"] == {"unknown": "!hasNewHome"}
    assert entries["Explore → Preview"] == {"unknown": "hasPreview"}
    assert entries["Explore → Saved"] is None


def test_label_inside_a_condition_block_does_not_end_it(frontend_dir: str) -> None:
    entries = {e.crumbs: e.when for e in parse_nav_entries(frontend_dir)}
    assert entries["Explore → Beta"] == {"unknown": "hasBeta"}
    assert entries["Explore → Releases"] is None


def test_settings_show_expressions_become_conditions(frontend_dir: str) -> None:
    entries = {e.crumbs: e.when for e in parse_nav_entries(frontend_dir)}
    assert entries["Settings → Organization → Teams"] is None
    assert entries["Settings → Organization → Early Features"] == {"deployment": "self_hosted"}
    assert entries["Settings → Organization → Code Review"] == {
        "any": [{"flag": "a"}, {"flag": "b"}]
    }
    assert "Settings → Organization → Old" not in entries


def test_flag_dependent_titles_become_one_entry_per_label(frontend_dir: str) -> None:
    entries = {e.crumbs: (e.path, e.when) for e in parse_nav_entries(frontend_dir)}
    assert entries["Settings → Organization → General"] == ("/settings/", {"flag": "settings-v3"})
    assert entries["Settings → Organization → General Settings"] == (
        "/settings/",
        {"not": {"flag": "settings-v3"}},
    )


@pytest.mark.parametrize(
    ("expr", "expected"),
    [
        ("!!organization?.features?.includes('x')", {"flag": "x"}),
        ("!isSelfHosted", {"not": {"deployment": "self_hosted"}}),
        ("!hasTempestAccess(organization)", {"unknown": "!hasTempestAccess(organization)"}),
        ("true", None),
        ("access?.has('org:billing')", {"scope": "org:billing"}),
    ],
)
def test_js_condition(expr: str, expected: Condition | None) -> None:
    assert _js_condition(expr) == expected


def test_gsapp_billing_settings_join_settings_nav(frontend_dir: str, tmp_path: Path) -> None:
    gsapp_dir = tmp_path / "gsApp"
    _write(gsapp_dir, "overrides/useBillingNavigationConfig.tsx", BILLING_SETTINGS)
    entries = {e.crumbs: (e.path, e.when) for e in parse_nav_entries(frontend_dir, str(gsapp_dir))}
    assert entries["Settings → Usage & Billing → Subscription"] == (
        "/settings/billing/",
        {"any": [{"scope": "org:billing"}, {"unknown": "membersCanViewSubscriptionInfo"}]},
    )
    assert entries["Settings → Usage & Billing → Spend Allocations"] == (
        "/settings/subscription/spend-allocations/",
        {"flag": "spend-allocations"},
    )
    assert entries["Settings → Usage & Billing → Legal & Compliance"] == ("/settings/legal/", None)


def test_billing_settings_need_the_gsapp_tree(frontend_dir: str) -> None:
    assert not any("Usage & Billing" in e.crumbs for e in parse_nav_entries(frontend_dir))


def test_show_new_seer_becomes_its_flag_checks() -> None:
    assert _js_condition("!showNewSeer(organization)") == {
        "not": {
            "any": [
                {"flag": "seat-based-seer-enabled"},
                {"flag": "token-billed-seer-enabled"},
                {
                    "all": [
                        {"not": {"flag": "seer-added"}},
                        {"not": {"flag": "code-review-beta"}},
                        {"flag": "seer-user-billing-launch"},
                    ]
                },
            ]
        }
    }


def test_alias_source_guard(tmp_path: Path) -> None:
    source = "export function showNewSeer(organization) {\n  return true;\n}\n"
    _write(tmp_path, "utils/seer/showNewSeer.ts", source)
    hashes = {"utils/seer/showNewSeer.ts": parser._code_hash(source)}
    with mock.patch.object(parser, "_ALIAS_SOURCES", hashes):
        check_alias_sources(str(tmp_path))

        # Comment and whitespace edits don't trip it; code edits and a moved file do.
        _write(tmp_path, "utils/seer/showNewSeer.ts", "// note\n" + source.replace("  ", "    "))
        check_alias_sources(str(tmp_path))
        _write(tmp_path, "utils/seer/showNewSeer.ts", source.replace("true", "false"))
        with pytest.raises(SystemExit, match=r"showNewSeer\.ts changed"):
            check_alias_sources(str(tmp_path))
        (tmp_path / "utils/seer/showNewSeer.ts").unlink()
        with pytest.raises(SystemExit, match=r"showNewSeer\.ts changed"):
            check_alias_sources(str(tmp_path))


def test_routes_under_a_computed_path_are_skipped() -> None:
    routes = """
const insightsRoutes = {
  path: '/insights/',
  children: [
    {path: 'overview/', name: t('Overview')},
    {
      path: `${MODULE_BASE_URLS[ModuleName.HTTP]}/`,
      children: [{path: 'domains/', name: t('Domains')}],
    },
  ],
};
"""
    assert _parse_route_tree(routes) == [("/insights/", None), ("/insights/overview/", "Overview")]
