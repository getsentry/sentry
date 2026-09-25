from unittest.mock import patch

from sentry.ingest.legacy_filter_lists import (
    STAGE_OPTION,
    LegacyFilterList,
    Stage,
    copy_lists,
    get_list,
    get_lists,
    set_list,
    stage,
    without_hidden_rows,
)
from sentry.models.custominboundfilter import CustomInboundFilter, LegacyFilter
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

MIRROR_RELEASES = {STAGE_OPTION: {"releases": "mirror"}}


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


@override_options({STAGE_OPTION: {"releases": "mirror", "log_messages": "typo"}})
def test_stage_defaults_to_off_for_a_missing_or_unknown_value() -> None:
    assert stage(LegacyFilterList.RELEASES) is Stage.MIRROR
    assert stage(LegacyFilterList.LOG_MESSAGES) is Stage.OFF
    assert stage(LegacyFilterList.ERROR_MESSAGES) is Stage.OFF


def test_stages_are_ordered() -> None:
    assert Stage.MIRROR.at_least(Stage.OFF)
    assert Stage.MIRROR.at_least(Stage.MIRROR)
    assert not Stage.MIRROR.at_least(Stage.ROWS)
    assert Stage.V2.at_least(Stage.ROWS)


@django_db_all
def test_off_writes_and_reads_the_option_only(default_project) -> None:
    set_list(default_project, LegacyFilterList.RELEASES, ["1.*", "# 2.*"])

    assert default_project.get_option("sentry:releases") == ["1.*", "# 2.*"]
    assert rows_of(default_project) == []
    assert get_list(default_project, LegacyFilterList.RELEASES) == ["1.*", "# 2.*"]


@django_db_all
@override_options(MIRROR_RELEASES)
def test_mirror_writes_the_option_and_one_row_with_every_line(default_project) -> None:
    lines = ["1.*", "# block staging until the fix ships", "1.*", "3.*"]
    set_list(default_project, LegacyFilterList.RELEASES, lines)

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
    assert get_list(default_project, LegacyFilterList.RELEASES) == lines


@django_db_all
@override_options(MIRROR_RELEASES)
def test_mirror_leaves_the_other_lists_on_the_option(default_project) -> None:
    set_list(default_project, LegacyFilterList.ERROR_MESSAGES, ["TypeError*"])

    assert default_project.get_option("sentry:error_messages") == ["TypeError*"]
    assert rows_of(default_project) == []


@django_db_all
@override_options(MIRROR_RELEASES)
def test_mirror_updates_the_lines_and_keeps_the_users_name_and_active_flag(
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

    set_list(default_project, LegacyFilterList.RELEASES, ["2.*"])

    row.refresh_from_db()
    assert row.name == "My old builds"
    assert row.active is False
    assert row.conditions == [{"type": "release", "value": ["2.*"]}]
    user_filter.refresh_from_db()
    assert user_filter.conditions == [{"type": "release", "value": ["mine*"]}]


@django_db_all
@override_options(MIRROR_RELEASES)
def test_mirror_removes_the_row_for_an_empty_list(default_project) -> None:
    set_list(default_project, LegacyFilterList.RELEASES, ["1.*"])
    set_list(default_project, LegacyFilterList.RELEASES, [])

    assert default_project.get_option("sentry:releases") == []
    assert rows_of(default_project) == []


@django_db_all
@override_options(MIRROR_RELEASES)
def test_mirror_counts_whether_the_row_agrees_with_the_option(default_project, factories) -> None:
    default_project.update_option("sentry:releases", ["1.*"])

    with patch("sentry.ingest.legacy_filter_lists.metrics.incr") as incr:
        assert get_list(default_project, LegacyFilterList.RELEASES) == ["1.*"]
    incr.assert_called_once_with(
        "inbound_filters.legacy_list.compared", tags={"list": "releases", "match": False}
    )

    factories.create_project_custom_inbound_filter(
        default_project,
        data_type="all",
        conditions=[{"type": "release", "value": ["1.*"]}],
        legacy_filter=LegacyFilter.RELEASE_VERSION,
    )
    with patch("sentry.ingest.legacy_filter_lists.metrics.incr") as incr:
        assert get_list(default_project, LegacyFilterList.RELEASES) == ["1.*"]
    incr.assert_called_once_with(
        "inbound_filters.legacy_list.compared", tags={"list": "releases", "match": True}
    )


@django_db_all
def test_off_does_not_compare(default_project) -> None:
    default_project.update_option("sentry:releases", ["1.*"])

    with patch("sentry.ingest.legacy_filter_lists.metrics.incr") as incr:
        get_list(default_project, LegacyFilterList.RELEASES)
    incr.assert_not_called()


@django_db_all
@override_options(MIRROR_RELEASES)
def test_get_lists_reads_the_options_it_is_given(default_project, factories) -> None:
    other = factories.create_project(organization=default_project.organization)
    options_by_project = {
        default_project.id: {"sentry:releases": ["1.*"], "sentry:log_messages": ["*DEBUG*"]},
    }

    with patch("sentry.ingest.legacy_filter_lists.metrics.incr") as incr:
        lists = get_lists([default_project, other], options_by_project)

    assert lists[default_project.id] == {
        LegacyFilterList.RELEASES: ["1.*"],
        LegacyFilterList.ERROR_MESSAGES: [],
        LegacyFilterList.LOG_MESSAGES: ["*DEBUG*"],
        LegacyFilterList.TRACE_METRIC_NAMES: [],
    }
    assert lists[other.id] == {legacy_list: [] for legacy_list in LegacyFilterList}
    assert incr.call_count == 2


@django_db_all
@override_options(MIRROR_RELEASES)
def test_copy_lists_copies_the_lists_the_source_has(default_project, factories) -> None:
    source = factories.create_project(organization=default_project.organization)
    set_list(source, LegacyFilterList.RELEASES, ["1.*"])
    set_list(default_project, LegacyFilterList.ERROR_MESSAGES, ["TypeError*"])

    copy_lists(source, default_project)

    assert get_list(default_project, LegacyFilterList.RELEASES) == ["1.*"]
    assert get_list(default_project, LegacyFilterList.ERROR_MESSAGES) == ["TypeError*"]
    assert rows_of(default_project) == [
        {
            "name": "Releases",
            "active": True,
            "data_type": "all",
            "conditions": [{"type": "release", "value": ["1.*"]}],
            "legacy_filter": "release-version",
        }
    ]


@django_db_all
@override_options({STAGE_OPTION: {"releases": "mirror", "error_messages": "off"}})
def test_hidden_rows_are_the_legacy_rows_below_the_v2_stage(default_project, factories) -> None:
    releases = factories.create_project_custom_inbound_filter(
        default_project,
        data_type="all",
        conditions=[{"type": "release", "value": ["1.*"]}],
        legacy_filter=LegacyFilter.RELEASE_VERSION,
    )
    error_messages = factories.create_project_custom_inbound_filter(
        default_project,
        data_type="error",
        conditions=[{"type": "error_message", "value": ["TypeError*"]}],
        legacy_filter=LegacyFilter.ERROR_MESSAGE,
    )
    mine = factories.create_project_custom_inbound_filter(default_project)

    visible = without_hidden_rows(CustomInboundFilter.objects.filter(project_id=default_project.id))

    assert set(visible.values_list("id", flat=True)) == {mine.id}
    assert releases.id != error_messages.id
