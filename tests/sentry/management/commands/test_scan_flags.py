from sentry.features.base import OrganizationFeature, ProjectFeature, SystemFeature
from sentry.management.commands.scan_flags import (
    FlagReport,
    _parse_permanent_names,
    enumerate_flags,
)
from sentry.testutils.cases import TestCase

# Fixtures: a small set of fake flags with known properties
FAKE_ALL_FEATURES: dict[str, type] = {
    "organizations:alpha-feature": OrganizationFeature,
    "organizations:beta-feature": OrganizationFeature,
    "projects:gamma-feature": ProjectFeature,
    "auth:delta-feature": SystemFeature,
}
FAKE_FLAGPOLE = {"organizations:alpha-feature", "projects:gamma-feature"}
FAKE_EXPOSED = {"organizations:alpha-feature", "organizations:beta-feature"}
FAKE_DEFAULTS: dict[str, bool] = {
    "organizations:alpha-feature": True,
    "organizations:beta-feature": False,
}
FAKE_PERMANENT = {"organizations:beta-feature"}


def _enumerate(**overrides):
    """Call enumerate_flags with fake data, allowing per-test overrides."""
    kwargs = dict(
        all_features=FAKE_ALL_FEATURES,
        flagpole_features=FAKE_FLAGPOLE,
        exposed_features=FAKE_EXPOSED,
        feature_defaults=FAKE_DEFAULTS,
        permanent_names=FAKE_PERMANENT,
    )
    kwargs.update(overrides)
    return enumerate_flags(**kwargs)


class EnumerateFlagsTest(TestCase):
    def test_returns_one_report_per_flag(self):
        reports = _enumerate()
        assert set(reports.keys()) == set(FAKE_ALL_FEATURES.keys())

    def test_report_names_match_keys(self):
        reports = _enumerate()
        for name, report in reports.items():
            assert isinstance(report, FlagReport)
            assert report.registration.name == name

    def test_permanent_vs_temporary(self):
        reports = _enumerate()
        assert reports["organizations:beta-feature"].registration.source_type == "permanent"
        assert reports["organizations:alpha-feature"].registration.source_type == "temporary"
        assert reports["projects:gamma-feature"].registration.source_type == "temporary"

    def test_feature_class(self):
        reports = _enumerate()
        assert (
            reports["organizations:alpha-feature"].registration.feature_class
            == "OrganizationFeature"
        )
        assert reports["projects:gamma-feature"].registration.feature_class == "ProjectFeature"
        assert reports["auth:delta-feature"].registration.feature_class == "SystemFeature"

    def test_handler_strategy(self):
        reports = _enumerate()
        assert reports["organizations:alpha-feature"].registration.handler_strategy == "FLAGPOLE"
        assert reports["projects:gamma-feature"].registration.handler_strategy == "FLAGPOLE"
        assert reports["organizations:beta-feature"].registration.handler_strategy == "INTERNAL"
        assert reports["auth:delta-feature"].registration.handler_strategy == "INTERNAL"

    def test_api_expose(self):
        reports = _enumerate()
        assert reports["organizations:alpha-feature"].registration.api_expose is True
        assert reports["organizations:beta-feature"].registration.api_expose is True
        assert reports["projects:gamma-feature"].registration.api_expose is False
        assert reports["auth:delta-feature"].registration.api_expose is False

    def test_default_values(self):
        reports = _enumerate()
        assert reports["organizations:alpha-feature"].registration.default is True
        assert reports["organizations:beta-feature"].registration.default is False
        # Not in defaults dict → False
        assert reports["projects:gamma-feature"].registration.default is False

    def test_report_field_defaults(self):
        reports = _enumerate()
        report = reports["organizations:alpha-feature"]
        assert report.usages == []
        assert report.flagpole is None
        assert report.in_plan_lists == []
        assert report.owner == ""
        assert report.last_code_change is None
        assert report.last_flagpole_change is None
        assert report.status == ""

    def test_empty_inputs(self):
        reports = enumerate_flags(
            all_features={},
            flagpole_features=set(),
            exposed_features=set(),
            feature_defaults={},
            permanent_names=set(),
        )
        assert reports == {}

    def test_all_permanent(self):
        reports = _enumerate(permanent_names=set(FAKE_ALL_FEATURES.keys()))
        for report in reports.values():
            assert report.registration.source_type == "permanent"

    def test_all_temporary(self):
        reports = _enumerate(permanent_names=set())
        for report in reports.values():
            assert report.registration.source_type == "temporary"


class ParsePermanentNamesTest(TestCase):
    def test_extracts_flag_names(self):
        content = """
    permanent_organization_features = {
        "organizations:advanced-search": True,
        "organizations:change-alerts": True,
        "organizations:custom-symbol-sources": False,
    }
"""
        names = _parse_permanent_names(content)
        assert names == {
            "organizations:advanced-search",
            "organizations:change-alerts",
            "organizations:custom-symbol-sources",
        }

    def test_ignores_non_flag_keys(self):
        content = """
    permanent_organization_features = {
        # A comment
        "not-a-flag": True,
        "organizations:real-flag": False,
    }
"""
        names = _parse_permanent_names(content)
        assert names == {"organizations:real-flag"}

    def test_empty_content(self):
        assert _parse_permanent_names("") == set()
