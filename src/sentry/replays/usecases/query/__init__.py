from __future__ import annotations

from sentry.replays.lib.new_query.conditions import (
    IPv4Scalar,
    NumericScalar,
    StringComposite,
    StringScalar,
)
from sentry.replays.lib.new_query.fields import Field, QueryConfig
from sentry.replays.lib.new_query.parsers import parse_int, parse_str, parse_uuid
from sentry.replays.lib.selector.parse import parse_selector
from sentry.replays.usecases.query.selector import ClickSelector
from sentry.replays.usecases.query.tags import TagScalar

StringField = Field(parse_str, StringScalar)
StringArrayField = Field(lambda vs: [parse_str(v) for v in vs], StringComposite)
IntegerField = Field(parse_int, NumericScalar)
SelectorField = Field(parse_selector, ClickSelector)
TagField = Field(parse_str, TagScalar)
UUIDField = Field(parse_uuid, StringScalar)
IPv4Field = Field(parse_str, IPv4Scalar)


search_config: QueryConfig = {
    "activity": IntegerField,
    "browser.name": StringField,
    "browser.version": StringField,
    "click.alt": StringField,
    "click.aria_label": StringField,
    "click.class": StringField,
    "click.id": StringField,
    "click.role": StringField,
    "click.selector": SelectorField,
    "click.tag": StringField,
    "click.testid": StringField,
    "click.text": StringField,
    "click.title": StringField,
    "count_dead_clicks": IntegerField,
    "count_errors": IntegerField,
    "count_rage_clicks": IntegerField,
    "count_segments": IntegerField,
    "count_urls": IntegerField,
    "device.brand": StringField,
    "device.family": StringField,
    "device.model": StringField,
    "device.name": StringField,
    "dist": StringField,
    "duration": IntegerField,
    "environment": StringField,
    "error_ids": StringArrayField,
    "os.name": StringField,
    "os.version": StringField,
    "platform": StringField,
    "releases": StringArrayField,
    "replay_id": UUIDField,
    "replay_type": StringField,
    "sdk.name": StringField,
    "sdk.version": StringField,
    "trace_ids": StringArrayField,
    "urls": StringArrayField,
    "user.email": StringField,
    "user.id": StringField,
    "user.ip_address": IPv4Field,
    "user.username": StringField,
}


# Objects have child keys which can be explicitly searched.  To ease the search experience of
# user's we map the outer object's name to one of the inner keys.  This acts as a default search
# target if none was specified.
search_config["browser"] = search_config["browser_name"]
search_config["device"] = search_config["device_name"]
search_config["os"] = search_config["os_name"]
search_config["sdk"] = search_config["sdk_name"]
search_config["user"] = search_config["user_username"]


# Fields which have multiple names that represent the same search operation are defined here.
search_config["error_id"] = search_config["error_ids"]
search_config["release"] = search_config["releases"]
search_config["trace_id"] = search_config["trace_ids"]
search_config["trace"] = search_config["trace_ids"]
search_config["url"] = search_config["urls"]


# Field-names which could not be found in the set are tag-keys and will, by default, look for
# the `*` key to find their search instructions. If this is not defined an error is returned.
search_config["*"] = TagField

#


def take_any_from_aggregation(
    column_name: str,
    alias: str | None = None,
    aliased: bool = True,
) -> Function:
    """Returns any value of a non group-by field. in our case, they are always the same,
    so the value should be consistent.
    """
    return Function(
        "any",
        parameters=[Column(column_name)],
        alias=alias or column_name if aliased else None,
    )


def _strip_uuid_dashes(
    input_name: str,
    input_value: Expression,
    alias: str | None = None,
    aliased: bool = True,
):
    return Function(
        "replaceAll",
        parameters=[Function("toString", parameters=[input_value]), "-", ""],
        alias=alias or input_name if aliased else None,
    )


def _activity_score():
    error_weight = Function("multiply", parameters=[Column("count_errors"), 25])
    pages_visited_weight = Function("multiply", parameters=[Column("count_urls"), 5])

    combined_weight = Function("plus", parameters=[error_weight, pages_visited_weight])
    combined_weight_normalized = Function("intDivOrZero", parameters=[combined_weight, 10])

    return Function(
        "floor",
        parameters=[
            Function(
                "greatest",
                parameters=[1, Function("least", parameters=[10, combined_weight_normalized])],
            )
        ],
        alias="activity",
    )


def _grouped_unique_values(
    column_name: str, alias: str | None = None, aliased: bool = False
) -> Function:
    """Returns an array of unique, non-null values.

    E.g.
        [1, 2, 2, 3, 3, 3, null] => [1, 2, 3]
    """
    return Function(
        "groupUniqArray",
        parameters=[Column(column_name)],
        alias=alias or column_name if aliased else None,
    )


def _sorted_aggregated_urls(agg_urls_column, alias):
    mapped_urls = Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["url_tuple"], Function("tupleElement", parameters=[Identifier("url_tuple"), 2])
            ),
            agg_urls_column,
        ],
    )
    mapped_sequence_ids = Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["url_tuple"], Function("tupleElement", parameters=[Identifier("url_tuple"), 1])
            ),
            agg_urls_column,
        ],
    )
    return Function(
        "arrayFlatten",
        parameters=[
            Function(
                "arraySort",
                parameters=[
                    Lambda(
                        ["urls", "sequence_id"],
                        Function("identity", parameters=[Identifier("sequence_id")]),
                    ),
                    mapped_urls,
                    mapped_sequence_ids,
                ],
            )
        ],
        alias=alias,
    )


from snuba_sdk import Column, Function, Identifier, Lambda
from snuba_sdk.expressions import Expression

query = {
    "activity": _activity_score(),
    "agg_urls": Function(
        "groupArray",
        parameters=[Function("tuple", parameters=[Column("segment_id"), Column("urls")])],
        alias="agg_urls",
    ),
    "agg_environment": take_any_from_aggregation(
        column_name="environment", alias="agg_environment"
    ),
    "browser_name": take_any_from_aggregation(column_name="browser_name"),
    "browser_version": take_any_from_aggregation(column_name="browser_version"),
    "click.alt": Function("groupArray", parameters=[Column("click_alt")], alias="click_alt"),
    "click.aria_label": Function(
        "groupArray", parameters=[Column("click_aria_label")], alias="click_aria_label"
    ),
    "click.class": Function(
        "groupArrayArray", parameters=[Column("click_class")], alias="clickClass"
    ),
    "click.classes": Function(
        "groupArray", parameters=[Column("click_class")], alias="click_classes"
    ),
    "click.id": Function("groupArray", parameters=[Column("click_id")], alias="click_id"),
    "click.role": Function("groupArray", parameters=[Column("click_role")], alias="click_role"),
    "click.tag": Function("groupArray", parameters=[Column("click_tag")], alias="click_tag"),
    "click.testid": Function(
        "groupArray", parameters=[Column("click_testid")], alias="click_testid"
    ),
    "click.text": Function("groupArray", parameters=[Column("click_text")], alias="click_text"),
    "click.title": Function("groupArray", parameters=[Column("click_title")], alias="click_title"),
    "count_dead_clicks": Function(
        "sum", parameters=[Column("click_is_dead")], alias="count_dead_clicks"
    ),
    "count_errors": Function(
        "sum",
        parameters=[Function("length", parameters=[Column("error_ids")])],
        alias="count_errors",
    ),
    "count_rage_clicks": Function(
        "sum", parameters=[Column("click_is_rage")], alias="count_rage_clicks"
    ),
    "count_segments": Function("count", parameters=[Column("segment_id")], alias="count_segments"),
    "count_urls": Function(
        "sum",
        parameters=[Function("length", parameters=[Column("urls")])],
        alias="count_urls",
    ),
    "device_brand": take_any_from_aggregation(column_name="device_brand"),
    "device_family": take_any_from_aggregation(column_name="device_family"),
    "device_model": take_any_from_aggregation(column_name="device_model"),
    "device_name": take_any_from_aggregation(column_name="device_name"),
    "dist": take_any_from_aggregation(column_name="dist"),
    "duration": Function(
        "dateDiff",
        parameters=["second", Column("started_at"), Column("finished_at")],
        alias="duration",
    ),
    "error_ids": Function(
        "arrayMap",
        parameters=[
            Lambda(["error_id"], _strip_uuid_dashes("error_id", Identifier("error_id"))),
            Function("groupUniqArrayArray", parameters=[Column("error_ids")]),
        ],
        alias="errorIds",
    ),
    "finished_at": Function("max", parameters=[Column("timestamp")], alias="finished_at"),
    "is_archived": Function(
        "ifNull",
        parameters=[Function("max", parameters=[Column("is_archived")]), 0],
        alias="isArchived",
    ),
    "os_name": take_any_from_aggregation(column_name="os_name"),
    "os_version": take_any_from_aggregation(column_name="os_version"),
    "platform": take_any_from_aggregation(column_name="platform"),
    "project_id": Column("project_id"),
    "releases": _grouped_unique_values(column_name="release", alias="releases", aliased=True),
    "replay_id": Column("replay_id"),
    "replay_type": take_any_from_aggregation(column_name="replay_type", alias="replay_type"),
    "sdk_name": take_any_from_aggregation(column_name="sdk_name"),
    "sdk_version": take_any_from_aggregation(column_name="sdk_version"),
    "started_at": Function(
        "min", parameters=[Column("replay_start_timestamp")], alias="started_at"
    ),
    "tk": Function("groupArrayArray", parameters=[Column("tags.key")], alias="tk"),
    "trace_ids": Function(
        "arrayMap",
        parameters=[
            Lambda(["trace_id"], _strip_uuid_dashes("trace_id", Identifier("trace_id"))),
            Function("groupUniqArrayArray", parameters=[Column("trace_ids")]),
        ],
        alias="traceIds",
    ),
    "tv": Function("groupArrayArray", parameters=[Column("tags.value")], alias="tv"),
    "urls_sorted": _sorted_aggregated_urls(Column("agg_urls"), "urls_sorted"),
    "user_email": take_any_from_aggregation(column_name="user_email"),
    "user_id": take_any_from_aggregation(column_name="user_id"),
    "user_ip": Function(
        "IPv4NumToString",
        parameters=[take_any_from_aggregation(column_name="ip_address_v4", aliased=False)],
        alias="user_ip",
    ),
    "user_username": take_any_from_aggregation(column_name="user_name", alias="user_username"),
}


FIELD_QUERY_ALIAS_MAP: dict[str, list[str]] = {
    "id": ["replay_id"],
    "replay_type": ["replay_type"],
    "project_id": ["project_id"],
    "project": ["project_id"],
    "platform": ["platform"],
    "environment": ["agg_environment"],
    "releases": ["releases"],
    "release": ["releases"],
    "dist": ["dist"],
    "trace_ids": ["trace_ids"],
    "trace_id": ["trace_ids"],
    "trace": ["trace_ids"],
    "error_ids": ["error_ids"],
    "error_id": ["error_ids"],
    "started_at": ["started_at"],
    "finished_at": ["finished_at"],
    "duration": ["duration", "started_at", "finished_at"],
    "urls": ["urls_sorted", "agg_urls"],
    "url": ["urls_sorted", "agg_urls"],
    "count_errors": ["count_errors"],
    "count_urls": ["count_urls"],
    "count_segments": ["count_segments"],
    "count_dead_clicks": ["count_dead_clicks"],
    "count_rage_clicks": ["count_rage_clicks"],
    "is_archived": ["is_archived"],
    "activity": ["activity", "count_errors", "count_urls"],
    "user": ["user_id", "user_email", "user_username", "user_ip"],
    "os": ["os_name", "os_version"],
    "browser": ["browser_name", "browser_version"],
    "device": ["device_name", "device_brand", "device_family", "device_model"],
    "sdk": ["sdk_name", "sdk_version"],
    "tags": ["tk", "tv"],
    # Nested fields.  Useful for selecting searchable fields.
    "user.id": ["user_id"],
    "user.email": ["user_email"],
    "user.username": ["user_username"],
    "user.ip": ["user_ip"],
    "os.name": ["os_name"],
    "os.version": ["os_version"],
    "browser.name": ["browser_name"],
    "browser.version": ["browser_version"],
    "device.name": ["device_name"],
    "device.brand": ["device_brand"],
    "device.family": ["device_family"],
    "device.model": ["device_model"],
    "sdk.name": ["sdk_name"],
    "sdk.version": ["sdk_version"],
    # Click actions
    "click.alt": ["click.alt"],
    "click.label": ["click.aria_label"],
    "click.class": ["click.class"],
    "click.id": ["click.id"],
    "click.role": ["click.role"],
    "click.tag": ["click.tag"],
    "click.testid": ["click.testid"],
    "click.textContent": ["click.text"],
    "click.title": ["click.title"],
    "click.selector": [
        "click.alt",
        "click.aria_label",
        "click.classes",
        "click.id",
        "click.role",
        "click.tag",
        "click.testid",
        "click.text",
        "click.title",
    ],
    "clicks": [
        "click.alt",
        "click.aria_label",
        "click.classes",
        "click.id",
        "click.role",
        "click.tag",
        "click.testid",
        "click.text",
        "click.title",
    ],
}
