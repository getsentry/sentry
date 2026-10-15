from sentry.ingest.inbound_filters import FilterTypes
from sentry.ingest.legacy_filter_lists import (
    DOUBLE_WRITE_FLAG,
    STAGE_OPTION,
    V2_FLAG,
    Stage,
    clean_lines,
    get_applied_lines,
    get_lines,
    read_rows,
    served_legacy_filters,
    set_list,
    stage,
)
from sentry.models.custominboundfilter import CustomInboundFilter, LegacyFilter
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

DOUBLE_WRITE_RELEASES = {STAGE_OPTION: {"releases": "double_write"}}
V2_RELEASES = {STAGE_OPTION: {"releases": "v2"}}


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
@override_options({STAGE_OPTION: {"releases": "double_write", "log_messages": "typo"}})
def test_stage_defaults_to_off_for_a_missing_or_unknown_value(default_organization) -> None:
    assert stage(FilterTypes.RELEASES, default_organization) is Stage.DOUBLE_WRITE
    assert stage(FilterTypes.LOG_MESSAGES, default_organization) is Stage.OFF
    assert stage(FilterTypes.ERROR_MESSAGES, default_organization) is Stage.OFF


@django_db_all
@with_feature(DOUBLE_WRITE_FLAG)
def test_flag_lifts_every_list_of_the_org_to_double_write(default_organization) -> None:
    assert stage(FilterTypes.RELEASES, default_organization) is Stage.DOUBLE_WRITE
    assert stage(FilterTypes.LOG_MESSAGES, default_organization) is Stage.DOUBLE_WRITE


@django_db_all
@with_feature(DOUBLE_WRITE_FLAG)
def test_flag_double_writes_the_list(default_project) -> None:
    set_list(default_project, FilterTypes.ERROR_MESSAGES, ["TypeError*"])

    assert default_project.get_option("sentry:error_messages") == ["TypeError*"]
    assert [row["legacy_filter"] for row in rows_of(default_project)] == ["error-message"]


@django_db_all
def test_off_writes_the_option_only(default_project) -> None:
    set_list(default_project, FilterTypes.RELEASES, ["1.*", "# 2.*"])

    assert default_project.get_option("sentry:releases") == ["1.*", "# 2.*"]
    assert rows_of(default_project) == []


@django_db_all
@override_options(DOUBLE_WRITE_RELEASES)
def test_double_write_writes_the_option_and_one_row_with_every_line(default_project) -> None:
    lines = ["1.*", "# block staging until the fix ships", "1.*", "3.*"]
    set_list(default_project, FilterTypes.RELEASES, lines)

    assert default_project.get_option("sentry:releases") == lines
    assert rows_of(default_project) == [
        {
            "name": "Releases",
            "active": True,
            "data_type": "all",
            "conditions": [{"type": "release", "value": lines}],
            "legacy_filter": "release-version",
        }
    ]


@django_db_all
@override_options(DOUBLE_WRITE_RELEASES)
def test_double_write_leaves_the_other_lists_on_the_option(default_project) -> None:
    set_list(default_project, FilterTypes.ERROR_MESSAGES, ["TypeError*"])

    assert default_project.get_option("sentry:error_messages") == ["TypeError*"]
    assert rows_of(default_project) == []


@django_db_all
@override_options(DOUBLE_WRITE_RELEASES)
def test_double_write_updates_the_lines_and_keeps_the_users_name_and_active_flag(
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
    assert row.conditions == [{"type": "release", "value": ["2.*"]}]
    user_filter.refresh_from_db()
    assert user_filter.conditions == [{"type": "release", "value": ["mine*"]}]


@django_db_all
@override_options(DOUBLE_WRITE_RELEASES)
def test_double_write_removes_the_row_for_an_empty_list(default_project) -> None:
    set_list(default_project, FilterTypes.RELEASES, ["1.*"])
    set_list(default_project, FilterTypes.RELEASES, [])

    assert default_project.get_option("sentry:releases") == []
    assert rows_of(default_project) == []


@django_db_all
@override_options(V2_RELEASES)
def test_option_puts_one_list_at_v2(default_organization) -> None:
    assert stage(FilterTypes.RELEASES, default_organization) is Stage.V2
    assert stage(FilterTypes.ERROR_MESSAGES, default_organization) is Stage.OFF
    assert served_legacy_filters(default_organization) == ["release-version"]


@django_db_all
@with_feature(V2_FLAG)
def test_v2_flag_lifts_every_list_of_the_org_to_v2(default_organization) -> None:
    assert stage(FilterTypes.RELEASES, default_organization) is Stage.V2
    assert stage(FilterTypes.LOG_MESSAGES, default_organization) is Stage.V2
    assert served_legacy_filters(default_organization) == [
        "release-version",
        "error-message",
        "log-message",
        "trace-metric-name",
    ]


@django_db_all
@override_options(V2_RELEASES)
def test_v2_writes_the_option_and_the_row(default_project) -> None:
    set_list(default_project, FilterTypes.RELEASES, ["1.*"])

    assert default_project.get_option("sentry:releases") == ["1.*"]
    assert [row["legacy_filter"] for row in rows_of(default_project)] == ["release-version"]


@django_db_all
@override_options(V2_RELEASES)
def test_v2_reads_the_row_and_an_earlier_stage_reads_the_option(default_project, factories) -> None:
    default_project.update_option("sentry:releases", ["stale"])
    default_project.update_option("sentry:error_messages", ["TypeError*"])
    factories.create_project_custom_inbound_filter(
        default_project,
        data_type="all",
        conditions=[{"type": "release", "value": ["1.*", "# 2.*"]}],
        legacy_filter=LegacyFilter.RELEASE_VERSION,
    )

    assert get_lines(default_project, FilterTypes.RELEASES) == ["1.*", "# 2.*"]
    assert get_applied_lines(default_project, FilterTypes.RELEASES) == ["1.*", "# 2.*"]
    assert get_lines(default_project, FilterTypes.ERROR_MESSAGES) == ["TypeError*"]
    assert read_rows([default_project]) == {default_project.id: {"releases": ["1.*", "# 2.*"]}}


@django_db_all
@override_options(V2_RELEASES)
def test_v2_reads_an_empty_list_without_a_row(default_project) -> None:
    default_project.update_option("sentry:releases", ["stale"])

    assert get_lines(default_project, FilterTypes.RELEASES) == []
    assert get_applied_lines(default_project, FilterTypes.RELEASES) == []
    assert read_rows([default_project]) == {default_project.id: {"releases": []}}


@django_db_all
@override_options(V2_RELEASES)
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


@django_db_all
def test_read_rows_is_empty_before_v2(default_project) -> None:
    assert read_rows([default_project]) == {}


def test_clean_lines_trims_drops_blanks_and_lowercases_releases_only() -> None:
    assert clean_lines(FilterTypes.RELEASES, [" 1.* ", "", "Beta*"]) == ["1.*", "beta*"]
    assert clean_lines(FilterTypes.ERROR_MESSAGES, [" TypeError* ", " "]) == ["TypeError*"]
