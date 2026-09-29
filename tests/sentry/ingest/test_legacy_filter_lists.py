from sentry.ingest.inbound_filters import FilterTypes
from sentry.ingest.legacy_filter_lists import STAGE_OPTION, Stage, set_list, stage
from sentry.models.custominboundfilter import CustomInboundFilter, LegacyFilter
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

DOUBLE_WRITE_RELEASES = {STAGE_OPTION: {"releases": "double_write"}}


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


@override_options({STAGE_OPTION: {"releases": "double_write", "log_messages": "typo"}})
def test_stage_defaults_to_off_for_a_missing_or_unknown_value() -> None:
    assert stage(FilterTypes.RELEASES) is Stage.DOUBLE_WRITE
    assert stage(FilterTypes.LOG_MESSAGES) is Stage.OFF
    assert stage(FilterTypes.ERROR_MESSAGES) is Stage.OFF


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
