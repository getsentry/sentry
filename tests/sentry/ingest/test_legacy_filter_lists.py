from sentry.ingest.inbound_filters import FilterTypes
from sentry.ingest.legacy_filter_lists import (
    clean_lines,
    get_applied_lines,
    get_lines,
    read_rows,
    served_legacy_filters,
    set_list,
)
from sentry.models.custominboundfilter import CustomInboundFilter, LegacyFilter
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.pytest.fixtures import django_db_all


def rows_of(project) -> list[dict]:
    return [
        {
            "name": f.name,
            "active": f.active,
            "data_type": f.data_type,
            "conditions": f.conditions,
            "legacy_filter": f.legacy_filter,
        }
        for f in CustomInboundFilter.objects.filter(project_id=project.id).order_by("id")
    ]


@django_db_all
def test_set_list_writes_the_option_and_one_row_with_every_line(default_project) -> None:
    lines = ["1.*", "# block staging until the fix ships", "1.*", "3.*"]
    set_list(default_project, FilterTypes.RELEASES, lines)

    assert default_project.get_option("sentry:releases") == lines
    assert rows_of(default_project) == [
        {
            "name": "Releases",
            "active": True,
            "data_type": "all",
            "conditions": [{"type": "release", "operator": "glob", "value": lines}],
            "legacy_filter": "release-version",
        }
    ]


@django_db_all
def test_set_list_updates_the_lines_and_keeps_the_users_name_and_active_flag(
    default_project, factories
) -> None:
    row = factories.create_project_custom_inbound_filter(
        default_project,
        name="My old builds",
        active=False,
        data_type="all",
        conditions=[{"type": "release", "value": ["1.*"]}],
        legacy_filter=LegacyFilter.RELEASE_VERSION,
    )
    user_filter = factories.create_project_custom_inbound_filter(
        default_project,
        name="Mine",
        data_type="all",
        conditions=[{"type": "release", "value": ["mine*"]}],
    )

    set_list(default_project, FilterTypes.RELEASES, ["2.*"])

    row.refresh_from_db()
    assert row.name == "My old builds"
    assert row.active is False
    assert row.conditions == [{"type": "release", "operator": "glob", "value": ["2.*"]}]
    user_filter.refresh_from_db()
    assert user_filter.conditions == [{"type": "release", "value": ["mine*"]}]


@django_db_all
def test_set_list_removes_the_row_for_an_empty_list(default_project) -> None:
    set_list(default_project, FilterTypes.RELEASES, ["1.*"])
    set_list(default_project, FilterTypes.RELEASES, [])

    assert default_project.get_option("sentry:releases") == []
    assert rows_of(default_project) == []


@django_db_all
def test_served_legacy_filters_is_empty_without_the_feature(default_organization) -> None:
    assert served_legacy_filters(default_organization) == []


@django_db_all
@with_feature("organizations:inbound-filters-v2")
def test_the_feature_serves_every_list_of_the_org(default_organization) -> None:
    assert served_legacy_filters(default_organization) == [
        "release-version",
        "error-message",
        "log-message",
        "trace-metric-name",
    ]


@django_db_all
@with_feature("organizations:inbound-filters-v2")
def test_v2_reads_the_row(default_project, factories) -> None:
    default_project.update_option("sentry:releases", ["stale"])
    factories.create_project_custom_inbound_filter(
        default_project,
        data_type="all",
        conditions=[{"type": "release", "value": ["1.*", "# 2.*"]}],
        legacy_filter=LegacyFilter.RELEASE_VERSION,
    )

    assert get_lines(default_project, FilterTypes.RELEASES) == ["1.*", "# 2.*"]
    assert get_applied_lines(default_project, FilterTypes.RELEASES) == ["1.*", "# 2.*"]
    assert read_rows([default_project]) == {
        default_project.id: {
            "releases": ["1.*", "# 2.*"],
            "error_messages": [],
            "log_messages": [],
            "trace_metric_names": [],
        }
    }


@django_db_all
def test_without_the_feature_reads_the_option(default_project, factories) -> None:
    default_project.update_option("sentry:releases", ["from the option"])
    factories.create_project_custom_inbound_filter(
        default_project,
        data_type="all",
        conditions=[{"type": "release", "value": ["from the row"]}],
        legacy_filter=LegacyFilter.RELEASE_VERSION,
    )

    assert get_lines(default_project, FilterTypes.RELEASES) == ["from the option"]
    assert get_applied_lines(default_project, FilterTypes.RELEASES) == ["from the option"]
    assert read_rows([default_project]) == {}


@django_db_all
@with_feature("organizations:inbound-filters-v2")
def test_v2_reads_an_empty_list_without_a_row(default_project) -> None:
    default_project.update_option("sentry:releases", ["stale"])

    assert get_lines(default_project, FilterTypes.RELEASES) == []
    assert get_applied_lines(default_project, FilterTypes.RELEASES) == []
    assert read_rows([default_project])[default_project.id]["releases"] == []


@django_db_all
@with_feature("organizations:inbound-filters-v2")
def test_v2_applies_nothing_while_the_row_is_switched_off(default_project, factories) -> None:
    factories.create_project_custom_inbound_filter(
        default_project,
        active=False,
        data_type="all",
        conditions=[{"type": "release", "value": ["1.*"]}],
        legacy_filter=LegacyFilter.RELEASE_VERSION,
    )

    assert get_lines(default_project, FilterTypes.RELEASES) == ["1.*"]
    assert get_applied_lines(default_project, FilterTypes.RELEASES) == []


def test_clean_lines_trims_drops_blanks_and_lowercases_releases_only() -> None:
    assert clean_lines(FilterTypes.RELEASES, [" 1.* ", "", "Beta*"]) == ["1.*", "beta*"]
    assert clean_lines(FilterTypes.ERROR_MESSAGES, [" TypeError* ", " "]) == ["TypeError*"]
