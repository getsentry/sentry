from typing import Any

from rest_framework import serializers

from sentry.ingest.inbound_filters.constants import FilterStatKeys


class FilterSerializer(serializers.Serializer[dict[str, Any]]):
    active = serializers.BooleanField(
        help_text="Toggle the browser-extensions, localhost, filtered-transaction, web-crawlers or health-check filter on or off.",
        required=False,
    )


class LegacyBrowserFilterSerializer(FilterSerializer):
    subfilters = serializers.MultipleChoiceField(
        help_text="""
Specifies which legacy browser filters should be active. Anything excluded from the list will be
disabled. The options are:
- `ie` - Internet Explorer Version 11 and lower
- `edge` - Edge Version 110 and lower
- `safari` - Safari Version 15 and lower
- `firefox` - Firefox Version 110 and lower
- `chrome` - Chrome Version 110 and lower
- `opera` - Opera Version 99 and lower
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


class FilterSpec:
    """
    Data associated with a filter, it defines its name, id, default enable state and how its  state is serialized
    in the database

    id: the id of the filter
    name: name of the filter
    description: short description
    serializer_cls: class for filter serialization
    config_name: the name under which it will be serialized in the config (if None id will be used)
    """

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        serializer_cls: type[FilterSerializer] | None = None,
        config_name: str | None = None,
    ) -> None:
        self.id = id
        self.name = name
        self.description = description
        self.serializer_cls = serializer_cls or FilterSerializer
        self.config_name = config_name or id


localhost_filter = FilterSpec(
    id=FilterStatKeys.LOCALHOST,
    name="Filter out events coming from localhost",
    description="This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.",
)

browser_extensions_filter = FilterSpec(
    id=FilterStatKeys.BROWSER_EXTENSION,
    name="Filter out errors known to be caused by browser extensions",
    description="Certain browser extensions will inject inline scripts and are known to cause errors.",
)

legacy_browsers_filter = FilterSpec(
    id=FilterStatKeys.LEGACY_BROWSER,
    name="Filter out known errors from legacy browsers",
    description="Older browsers often give less accurate information, and while they may report valid issues, "
    "the context to understand them is incorrect or missing.",
    serializer_cls=LegacyBrowserFilterSerializer,
)

web_crawlers_filter = FilterSpec(
    id=FilterStatKeys.WEB_CRAWLER,
    name="Filter out known web crawlers",
    description="Some crawlers may execute pages in incompatible ways which then cause errors that"
    " are unlikely to be seen by a normal user.",
)

healthcheck_filter = FilterSpec(
    id=FilterStatKeys.HEALTH_CHECK,
    name="Filter out health check transactions",
    description="Filter transactions that match most common naming patterns for health checks.",
    serializer_cls=None,
    config_name="ignoreTransactions",
)
