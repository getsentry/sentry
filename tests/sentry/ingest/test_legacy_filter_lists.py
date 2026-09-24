from sentry.ingest.legacy_filter_lists import LegacyFilterList, get_legacy_lists, set_legacy_list
from sentry.models.custominboundfilter import CustomInboundFilter
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

ROWS_ONLY = {"relay.inbound-filters.custom-filter-rows-only": True}


def rows_of(project) -> list[dict]:
    return [
        {
            "name": f.name,
            "active": f.active,
            "data_type": f.data_type,
            "conditions": f.conditions,
        }
        for f in CustomInboundFilter.objects.filter(project_id=project.id).order_by("id")
    ]


def legacy_list(project, legacy_list: LegacyFilterList) -> list[str]:
    return get_legacy_lists([project], {})[project.id][legacy_list]


@django_db_all
def test_before_the_switch_the_lists_stay_in_the_options(default_project) -> None:
    set_legacy_list(default_project, LegacyFilterList.RELEASES, ["1.*", "# 2.*"])

    assert default_project.get_option("sentry:releases") == ["1.*", "# 2.*"]
    assert rows_of(default_project) == []

    lists = get_legacy_lists([default_project], {default_project.id: {"sentry:releases": ["3.*"]}})
    assert lists[default_project.id][LegacyFilterList.RELEASES] == ["3.*"]
    assert lists[default_project.id][LegacyFilterList.ERROR_MESSAGES] == []


@django_db_all
@override_options(ROWS_ONLY)
def test_writes_active_and_comment_lines_to_two_named_rows(default_project) -> None:
    set_legacy_list(
        default_project,
        LegacyFilterList.RELEASES,
        ["1.*", "1.*", "# 2.*", "#"],
    )

    assert default_project.get_option("sentry:releases") is None
    assert rows_of(default_project) == [
        {
            "name": "Releases",
            "active": True,
            "data_type": "all",
            "conditions": [{"type": "release", "value": ["1.*"]}],
        },
        {
            "name": "Releases (disabled)",
            "active": False,
            "data_type": "all",
            "conditions": [{"type": "release", "value": ["2.*"]}],
        },
    ]
    assert legacy_list(default_project, LegacyFilterList.RELEASES) == [
        "1.*",
        "# 2.*",
    ]


@django_db_all
@override_options(ROWS_ONLY)
def test_writes_update_the_backfilled_rows_in_place(default_project, factories) -> None:
    backfilled = factories.create_project_custom_inbound_filter(
        default_project,
        name="Error Messages",
        data_type="error",
        conditions=[{"type": "error_message", "value": ["TypeError*"]}],
    )
    disabled = factories.create_project_custom_inbound_filter(
        default_project,
        name="Error Messages (disabled)",
        active=False,
        data_type="error",
        conditions=[{"type": "error_message", "value": ["old*"]}],
    )
    user_filter = factories.create_project_custom_inbound_filter(
        default_project,
        name="Mine",
        data_type="error",
        conditions=[{"type": "error_message", "value": ["mine*"]}],
    )

    set_legacy_list(default_project, LegacyFilterList.ERROR_MESSAGES, ["ValueError*"])

    backfilled.refresh_from_db()
    assert backfilled.conditions == [{"type": "error_message", "value": ["ValueError*"]}]
    assert not CustomInboundFilter.objects.filter(id=disabled.id).exists()
    assert CustomInboundFilter.objects.filter(id=user_filter.id).exists()


@django_db_all
@override_options(ROWS_ONLY)
def test_comments_survive_a_round_trip(default_project) -> None:
    lines = ["1.*", "# block staging until the fix ships", "3.*", "#2.*"]
    set_legacy_list(default_project, LegacyFilterList.RELEASES, lines)

    # The text of every comment survives. Comments move after the active lines, and
    # the space after "#" is normalized.
    assert legacy_list(default_project, LegacyFilterList.RELEASES) == [
        "1.*",
        "3.*",
        "# block staging until the fix ships",
        "# 2.*",
    ]

    set_legacy_list(
        default_project,
        LegacyFilterList.RELEASES,
        legacy_list(default_project, LegacyFilterList.RELEASES),
    )
    assert legacy_list(default_project, LegacyFilterList.RELEASES) == [
        "1.*",
        "3.*",
        "# block staging until the fix ships",
        "# 2.*",
    ]


@django_db_all
@override_options(ROWS_ONLY)
def test_an_empty_list_removes_its_rows(default_project) -> None:
    set_legacy_list(default_project, LegacyFilterList.LOG_MESSAGES, ["*DEBUG*", "# *INFO*"])
    set_legacy_list(default_project, LegacyFilterList.LOG_MESSAGES, [])

    assert rows_of(default_project) == []
    assert legacy_list(default_project, LegacyFilterList.LOG_MESSAGES) == []


@django_db_all
@override_options(ROWS_ONLY)
def test_reads_a_row_switched_off_in_the_new_ui_as_comment_lines(
    default_project, factories
) -> None:
    factories.create_project_custom_inbound_filter(
        default_project,
        name="Releases",
        active=False,
        data_type="all",
        conditions=[{"type": "release", "value": ["1.*", "2.*"]}],
    )
    factories.create_project_custom_inbound_filter(
        default_project,
        name="Something else",
        data_type="all",
        conditions=[{"type": "release", "value": ["3.*"]}],
    )

    assert legacy_list(default_project, LegacyFilterList.RELEASES) == ["# 1.*", "# 2.*"]


@django_db_all
@override_options(ROWS_ONLY)
def test_reads_and_writes_agree_on_one_row_when_names_repeat(default_project, factories) -> None:
    first = factories.create_project_custom_inbound_filter(
        default_project,
        name="Metric Names",
        data_type="metric",
        conditions=[{"type": "metric_name", "value": ["a.*"]}],
    )
    second = factories.create_project_custom_inbound_filter(
        default_project,
        name="Metric Names",
        data_type="metric",
        conditions=[{"type": "metric_name", "value": ["b.*"]}],
    )

    assert legacy_list(default_project, LegacyFilterList.TRACE_METRIC_NAMES) == ["a.*"]

    set_legacy_list(default_project, LegacyFilterList.TRACE_METRIC_NAMES, ["c.*"])

    first.refresh_from_db()
    second.refresh_from_db()
    assert first.conditions == [{"type": "metric_name", "value": ["c.*"]}]
    assert second.conditions == [{"type": "metric_name", "value": ["b.*"]}]
