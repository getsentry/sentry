from collections.abc import Callable, Sequence
from typing import cast

from rest_framework import serializers

from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.relay.types import GenericFilter, GenericFiltersConfig, RuleCondition
from sentry.relay.utils import to_camel_case_name
from sentry.signals import inbound_filter_toggled
from sentry.tsdb.base import TSDBModel

GENERIC_FILTERS_VERSION = 1


class FilterStatKeys:
    """
    NOTE: This enum also exists in Relay, check if alignment is needed when
    editing this.
    """

    IP_ADDRESS = "ip-address"
    RELEASE_VERSION = "release-version"
    ERROR_MESSAGE = "error-message"
    BROWSER_EXTENSION = "browser-extensions"
    LEGACY_BROWSER = "legacy-browsers"
    LOCALHOST = "localhost"
    WEB_CRAWLER = "web-crawlers"
    INVALID_CSP = "invalid-csp"
    CORS = "cors"
    DISCARDED_HASH = "discarded-hash"  # Not replicated in Relay
    CRASH_REPORT_LIMIT = "crash-report-limit"  # Not replicated in Relay
    HEALTH_CHECK = "filtered-transaction"  # Ignore health-check transactions


FILTER_STAT_KEYS_TO_VALUES = {
    FilterStatKeys.IP_ADDRESS: TSDBModel.project_total_received_ip_address,
    FilterStatKeys.RELEASE_VERSION: TSDBModel.project_total_received_release_version,
    FilterStatKeys.ERROR_MESSAGE: TSDBModel.project_total_received_error_message,
    FilterStatKeys.BROWSER_EXTENSION: TSDBModel.project_total_received_browser_extensions,
    FilterStatKeys.LEGACY_BROWSER: TSDBModel.project_total_received_legacy_browsers,
    FilterStatKeys.LOCALHOST: TSDBModel.project_total_received_localhost,
    FilterStatKeys.WEB_CRAWLER: TSDBModel.project_total_received_web_crawlers,
    FilterStatKeys.INVALID_CSP: TSDBModel.project_total_received_invalid_csp,
    FilterStatKeys.CORS: TSDBModel.project_total_received_cors,
    FilterStatKeys.DISCARDED_HASH: TSDBModel.project_total_received_discarded,
    FilterStatKeys.HEALTH_CHECK: TSDBModel.project_total_healthcheck,
}


class FilterTypes:
    ERROR_MESSAGES = "error_messages"
    RELEASES = "releases"


def get_filter_key(flt):
    return to_camel_case_name(flt.config_name.replace("-", "_"))


def get_all_filter_specs():
    """
    Return metadata about the filters known by Sentry.

    An event filter is a function that receives a project_config and an event data payload and returns a tuple
    (should_filter:bool, filter_reason: string | None) representing

    :return: list of registered event filters
    """
    filters = [
        _localhost_filter,
        _browser_extensions_filter,
        _legacy_browsers_filter,
        _web_crawlers_filter,
        _healthcheck_filter,
    ]

    return tuple(filters)  # returning tuple for backwards compatibility


def set_filter_state(filter_id, project, state):
    flt = _filter_from_filter_id(filter_id)
    if flt is None:
        raise FilterNotRegistered(filter_id)

    if flt == _legacy_browsers_filter:
        if state is None:
            state = {}

        option_val: object = "0"
        if "active" in state:
            if state["active"]:
                option_val = "1"
        elif "subfilters" in state and len(state["subfilters"]) > 0:
            option_val = set(state["subfilters"])

        ProjectOption.objects.set_value(
            project=project, key=f"filters:{filter_id}", value=option_val
        )

        return option_val == "1" if option_val in ("0", "1") else option_val

    else:
        # all boolean filters
        if state is None:
            state = {"active": True}

        ProjectOption.objects.set_value(
            project=project,
            key=f"filters:{filter_id}",
            value="1" if state.get("active", False) else "0",
        )

        if state:
            inbound_filter_toggled.send(project=project, sender=flt)

        return state.get("active", False)


def get_filter_state(filter_id, project):
    """
    Returns the filter state

    IMPORTANT: this function accesses the database, it should NEVER be used by the ingestion pipe.
    This api is used by the ProjectFilterDetails and ProjectFilters endpoints
    :param filter_id: the filter Id
    :param project: the project for which we want the filter state
    :return: True if the filter is enabled False otherwise
    :raises: ValueError if filter id not registered
    """
    flt = _filter_from_filter_id(filter_id)
    if flt is None:
        raise FilterNotRegistered(filter_id)

    filter_state = ProjectOption.objects.get_value(project=project, key=f"filters:{flt.id}")

    if filter_state is None:
        raise ValueError(
            "Could not find filter state for filter {}."
            " You need to register default filter state in projectoptions.defaults.".format(
                filter_id
            )
        )

    if flt == _legacy_browsers_filter:
        # special handling for legacy browser state
        if filter_state == "1":
            return True
        if filter_state == "0":
            return False
        return filter_state
    else:
        return filter_state == "1"


class FilterNotRegistered(Exception):
    pass


def _filter_from_filter_id(filter_id):
    """
    Returns the corresponding filter for a filter id or None if no filter with the given id found
    """
    for flt in get_all_filter_specs():
        if flt.id == filter_id:
            return flt
    return None


class _FilterSerializer(serializers.Serializer):
    active = serializers.BooleanField(
        help_text="Toggle the browser-extensions, localhost, filtered-transaction, or web-crawlers filter on or off.",
        required=False,
    )


class _FilterSpec:
    """
    Data associated with a filter, it defines its name, id, default enable state and how its  state is serialized
    in the database

    id: the id of the filter
    name: name of the filter
    description: short description
    serializer_cls: class for filter serialization
    config_name: the name under which it will be serialized in the config (if None id will be used)
    """

    def __init__(self, id, name, description, serializer_cls=None, config_name=None):
        self.id = id
        self.name = name
        self.description = description
        if serializer_cls is None:
            self.serializer_cls = _FilterSerializer
        else:
            self.serializer_cls = serializer_cls

        if config_name is None:
            self.config_name = id
        else:
            self.config_name = config_name


def _get_filter_settings(project_config, flt):
    """
    Gets the filter options from the relay config or the default option if not specified in the relay config

    :param project_config: the relay config for the request
    :param flt: the filter
    :return: the options for the filter
    """
    filter_settings = project_config.config.get("filterSettings", {})
    return filter_settings.get(get_filter_key(flt), None)


_localhost_filter = _FilterSpec(
    id=FilterStatKeys.LOCALHOST,
    name="Filter out events coming from localhost",
    description="This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.",
)

_browser_extensions_filter = _FilterSpec(
    id=FilterStatKeys.BROWSER_EXTENSION,
    name="Filter out errors known to be caused by browser extensions",
    description="Certain browser extensions will inject inline scripts and are known to cause errors.",
)


class _LegacyBrowserFilterSerializer(_FilterSerializer):
    subfilters = serializers.MultipleChoiceField(
        help_text="""
Specifies which legacy browser filters should be active. Anything excluded from the list will be
disabled. The options are:
- `ie` - Internet Explorer Version 11 and lower
- `edge` - Edge Version 18 and lower
- `safari` - Safari Version 11 and lower
- `firefox` - Firefox Version 66 and lower
- `chrome` - Chrome Version 62 and lower
- `opera` - Opera Version 50 and lower
- `android` - Android Version 3 and lower
- `opera_mini` - Opera Mini Version 34 and lower

Deprecated options:
- `ie_pre_9` - Internet Explorer Version 8 and lower
- `ie9` - Internet Explorer Version 9
- `ie10` - Internet Explorer Version 10
- `ie11` - Internet Explorer Version 11
- `safari_pre_6` - Safari Version 5 and lower
- `opera_pre_15` - Opera Version 14 and lower
- `opera_mini_pre_8` - Opera Mini Version 8 and lower
- `android_pre_4` - Android Version 3 and lower
- `edge_pre_79` - Edge Version 18 and lower (non Chromium based)
""",
        choices=[
            "ie",
            "edge",
            "safari",
            "firefox",
            "chrome",
            "opera",
            "android",
            "opera_mini",
            "ie_pre_9",
            "ie9",
            "ie10",
            "ie11",
            "opera_pre_15",
            "android_pre_4",
            "safari_pre_6",
            "opera_mini_pre_8",
            "edge_pre_79",
        ],
        required=False,
    )


_legacy_browsers_filter = _FilterSpec(
    id=FilterStatKeys.LEGACY_BROWSER,
    name="Filter out known errors from legacy browsers",
    description="Older browsers often give less accurate information, and while they may report valid issues, "
    "the context to understand them is incorrect or missing.",
    serializer_cls=_LegacyBrowserFilterSerializer,
)


_web_crawlers_filter = _FilterSpec(
    id=FilterStatKeys.WEB_CRAWLER,
    name="Filter out known web crawlers",
    description="Some crawlers may execute pages in incompatible ways which then cause errors that"
    " are unlikely to be seen by a normal user.",
)


_healthcheck_filter = _FilterSpec(
    id=FilterStatKeys.HEALTH_CHECK,
    name="Filter out health check transactions",
    description="Filter transactions that match most common naming patterns for health checks.",
    serializer_cls=None,
    config_name="ignoreTransactions",
)


def _error_message_condition(values: Sequence[tuple[str | None, str | None]]) -> RuleCondition:
    """
    Condition that expresses error message matching for an inbound filter.
    """
    conditions = []

    for ty, value in values:
        ty_and_value: list[RuleCondition] = []

        if ty is not None:
            ty_and_value.append({"op": "glob", "name": "ty", "value": [ty]})
        if value is not None:
            ty_and_value.append({"op": "glob", "name": "value", "value": [value]})

        if len(ty_and_value) == 1:
            conditions.append(ty_and_value[0])
        elif len(ty_and_value) == 2:
            conditions.append(
                {
                    "op": "and",
                    "inner": ty_and_value,
                }
            )

    return cast(
        RuleCondition,
        {
            "op": "any",
            "name": "event.exception.values",
            "inner": {
                "op": "or",
                "inner": conditions,
            },
        },
    )


def _chunk_load_error_filter() -> RuleCondition:
    """
    Filters out chunk load errors.

    Example:
    ChunkLoadError: Loading chunk 3662 failed.\n(error:
    https://domain.com/_next/static/chunks/29107295-0151559bd23117ba.js)
    """
    values = [
        ("ChunkLoadError", "Loading chunk *"),
        ("*Uncaught *", "ChunkLoadError: Loading chunk *"),
    ]

    return _error_message_condition(values)


def _hydration_error_filter() -> RuleCondition:
    """
    Filters out hydration errors.

    Example:
    418 - Hydration failed because the initial UI does not match what was rendered on the server.
    419 - The server could not finish this Suspense boundary, likely due to an error during server rendering.
        Switched to client rendering.
    422 - There was an error while hydrating this Suspense boundary. Switched to client rendering.
    423 - There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire
        root will switch to client rendering.
    425 - Text content does not match server-rendered HTML.
    """
    values = [
        (None, "*https://reactjs.org/docs/error-decoder.html?invariant={418,419,422,423,425}*"),
        (None, "*https://react.dev/errors/{418,419,422,423,425}*"),
    ]

    return _error_message_condition(values)


# List of all active generic filters that Sentry currently sends to Relay.
ACTIVE_GENERIC_FILTERS: Sequence[tuple[str, Callable[[], RuleCondition]]] = [
    ("chunk-load-error", _chunk_load_error_filter),
    ("react-hydration-errors", _hydration_error_filter),
]


def get_generic_filters(project: Project) -> GenericFiltersConfig | None:
    """
    Computes the generic inbound filters configuration for inbound filters.

    Generic inbound filters are able to express arbitrary filtering conditions on an event, using
    Relay's `RuleCondition` DSL. They differ from static inbound filters which filter events based on a
    hardcoded set of rules, specific to each type.
    """
    generic_filters: list[GenericFilter] = []

    for generic_filter_id, generic_filter_fn in ACTIVE_GENERIC_FILTERS:
        # This option was defaulted to string but was changed at runtime to a boolean due to an error in the
        # implementation. In order to bring it back to a string, we need to repair on read stored options. This is
        # why the value true is determined by either `1` or `True`.
        if project.get_option(f"filters:{generic_filter_id}") not in ("1", True):
            continue

        condition = generic_filter_fn()
        if condition is not None:
            generic_filters.append(
                {
                    "id": generic_filter_id,
                    "isEnabled": True,
                    "condition": condition,
                }
            )

    if not generic_filters:
        return None

    return {
        "version": GENERIC_FILTERS_VERSION,
        "filters": generic_filters,
    }
