# TODO RaduW 8.06.2019 remove the sentry.filters package and rename this module to filters
from __future__ import absolute_import

import collections
from collections import namedtuple
import re

from rest_framework import serializers
from six.moves.urllib.parse import urlparse
from ua_parser.user_agent_parser import Parse

from sentry.api.fields.multiplechoice import MultipleChoiceField
from sentry.models.projectoption import ProjectOption
from sentry.signals import inbound_filter_toggled
from sentry.utils.data_filters import FilterStatKeys, get_filter_key
from sentry.utils.safe import get_path


EventFilteredRet = namedtuple("EventFilteredRet", "should_filter reason")


def should_filter_event(project_config, data):
    """
    Checks if an event should be filtered

    :param project_config: relay config for the request (for the project really)
    :param data: the event data
    :return: an EventFilteredRet explaining if the event should be filtered and, if it should the reason
        for filtering
    """
    for event_filter in get_all_filters():
        if _is_filter_enabled(project_config, event_filter) and event_filter(project_config, data):
            return EventFilteredRet(should_filter=True, reason=event_filter.spec.id)

    return EventFilteredRet(should_filter=False, reason=None)


def get_all_filters():
    """
    Returns a list of the existing event filters

    An event filter is a function that receives a project_config and an event data payload and returns a tuple
    (should_filter:bool, filter_reason: string | None) representing

    :return: list of registered event filters
    """
    return (
        _localhost_filter,
        _browser_extensions_filter,
        _legacy_browsers_filter,
        _web_crawlers_filter,
    )


def set_filter_state(filter_id, project, state):
    flt = _filter_from_filter_id(filter_id)
    if flt is None:
        raise FilterNotRegistered(filter_id)

    if flt == _legacy_browsers_filter:
        if state is None:
            state = {}

        option_val = "0"
        if "active" in state:
            if state["active"]:
                option_val = "1"
        elif "subfilters" in state and len(state["subfilters"]) > 0:
            option_val = set(state["subfilters"])

        ProjectOption.objects.set_value(
            project=project, key=u"filters:{}".format(filter_id), value=option_val
        )

        return option_val == "1" if option_val in ("0", "1") else option_val

    else:
        # all boolean filters
        if state is None:
            state = {"active": True}

        ProjectOption.objects.set_value(
            project=project,
            key=u"filters:{}".format(filter_id),
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

    filter_state = ProjectOption.objects.get_value(
        project=project, key=u"filters:{}".format(flt.spec.id)
    )

    if filter_state is None:
        raise ValueError(
            "Could not find filter state for filter {0}."
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
    for flt in get_all_filters():
        if flt.spec.id == filter_id:
            return flt
    return None


class _FilterSerializer(serializers.Serializer):
    active = serializers.BooleanField()


class _FilterSpec(object):
    """
    Data associated with a filter, it defines its name, id, default enable state and how its  state is serialized
    in the database
    """

    def __init__(self, id, name, description, serializer_cls=None):
        self.id = id
        self.name = name
        self.description = description
        if serializer_cls is None:
            self.serializer_cls = _FilterSerializer
        else:
            self.serializer_cls = serializer_cls


def _get_filter_settings(project_config, flt):
    """
    Gets the filter options from the relay config or the default option if not specified in the relay config

    :param project_config: the relay config for the request
    :param flt: the filter
    :return: the options for the filter
    """
    filter_settings = project_config.config.get("filterSettings", {})
    return filter_settings.get(get_filter_key(flt), None)


def _is_filter_enabled(project_config, flt):
    filter_options = _get_filter_settings(project_config, flt)

    if filter_options is None:
        raise ValueError("unknown filter", flt.spec.id)

    return filter_options["isEnabled"]


# ************* local host filter *************
_LOCAL_IPS = frozenset(["127.0.0.1", "::1"])
_LOCAL_DOMAINS = frozenset(["127.0.0.1", "localhost"])


def _localhost_filter(project_config, data):
    ip_address = get_path(data, "user", "ip_address") or ""
    url = get_path(data, "request", "url") or ""
    domain = urlparse(url).hostname

    return ip_address in _LOCAL_IPS or domain in _LOCAL_DOMAINS


_localhost_filter.spec = _FilterSpec(
    id=FilterStatKeys.LOCALHOST,
    name="Filter out events coming from localhost",
    description="This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.",
)

# ************* browser extensions filter *************
_EXTENSION_EXC_VALUES = re.compile(
    "|".join(
        (
            re.escape(x)
            for x in (
                # Random plugins/extensions
                "top.GLOBALS",
                # See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
                "originalCreateNotification",
                "canvas.contentDocument",
                "MyApp_RemoveAllHighlights",
                "http://tt.epicplay.com",
                "Can't find variable: ZiteReader",
                "jigsaw is not defined",
                "ComboSearch is not defined",
                "http://loading.retry.widdit.com/",
                "atomicFindClose",
                # Facebook borked
                "fb_xd_fragment",
                # ISP "optimizing" proxy - `Cache-Control: no-transform` seems to
                # reduce this. (thanks @acdha)
                # See http://stackoverflow.com/questions/4113268
                "bmi_SafeAddOnload",
                "EBCallBackMessageReceived",
                # See
                # https://groups.google.com/a/chromium.org/forum/#!topic/chromium-discuss/7VU0_VvC7mE
                "_gCrWeb",
                # See http://toolbar.conduit.com/Debveloper/HtmlAndGadget/Methods/JSInjection.aspx
                "conduitPage",
                # Google Search app (iOS)
                # See: https://github.com/getsentry/raven-js/issues/756
                "null is not an object (evaluating 'elt.parentNode')",
                # Dragon Web Extension from Nuance Communications
                # See: https://forum.sentry.io/t/error-in-raven-js-plugin-setsuspendstate/481/
                "plugin.setSuspendState is not a function",
                # lastpass
                "should_do_lastpass_here",
                # google translate
                # see https://medium.com/@amir.harel/a-b-target-classname-indexof-is-not-a-function-at-least-not-mine-8e52f7be64ca
                "a[b].target.className.indexOf is not a function",
            )
        )
    ),
    re.I,
)

_EXTENSION_EXC_SOURCES = re.compile(
    "|".join(
        (
            # Facebook flakiness
            r"graph\.facebook\.com",
            # Facebook blocked
            r"connect\.facebook\.net",
            # Woopra flakiness
            r"eatdifferent\.com\.woopra-ns\.com",
            r"static\.woopra\.com\/js\/woopra\.js",
            # Chrome extensions
            r"^chrome(?:-extension)?:\/\/",
            # Firefox extensions
            r"^moz-extension:\/\/",
            # Cacaoweb
            r"127\.0\.0\.1:4001\/isrunning",
            # Other
            r"webappstoolbarba\.texthelp\.com\/",
            r"metrics\.itunes\.apple\.com\.edgesuite\.net\/",
            # Kaspersky Protection browser extension
            r"kaspersky-labs\.com",
            # Google ad server (see http://whois.domaintools.com/2mdn.net)
            r"2mdn\.net",
        )
    ),
    re.I,
)


def _browser_extensions_filter(project_config, data):
    if data.get("platform") != "javascript":
        return False

    # get exception value
    try:
        exc_value = data["exception"]["values"][0]["value"]
    except (LookupError, TypeError):
        exc_value = ""
    if exc_value:
        if _EXTENSION_EXC_VALUES.search(exc_value):
            return True

    # get exception source
    try:
        exc_source = data["exception"]["values"][0]["stacktrace"]["frames"][-1]["abs_path"]
    except (LookupError, TypeError):
        exc_source = ""
    if exc_source:
        if _EXTENSION_EXC_SOURCES.search(exc_source):
            return True

    return False


_browser_extensions_filter.spec = _FilterSpec(
    id=FilterStatKeys.BROWSER_EXTENSION,
    name="Filter out errors known to be caused by browser extensions",
    description="Certain browser extensions will inject inline scripts and are known to cause errors.",
)

# ************* legacy browsers filter *************
MIN_VERSIONS = {
    "Chrome": 0,
    "IE": 10,
    "Firefox": 0,
    "Safari": 6,
    "Edge": 0,
    "Opera": 15,
    "Android": 4,
    "Opera Mini": 8,
}


def _legacy_browsers_filter(project_config, data):
    def get_user_agent(data):
        try:
            for key, value in get_path(data, "request", "headers", filter=True) or ():
                if key.lower() == "user-agent":
                    return value
        except LookupError:
            return ""

    if data.get("platform") != "javascript":
        return False

    value = get_user_agent(data)
    if not value:
        return False

    ua = Parse(value)
    if not ua:
        return False

    browser = ua["user_agent"]

    if not browser["family"]:
        return False

    # IE Desktop and IE Mobile use the same engines, therefore we can treat them as one
    if browser["family"] == "IE Mobile":
        browser["family"] = "IE"

    filter_settings = _get_filter_settings(project_config, _legacy_browsers_filter)

    # handle old style config
    if filter_settings is None:
        return _filter_default(browser)

    enabled_sub_filters = filter_settings.get("options")
    if isinstance(enabled_sub_filters, collections.Sequence):
        for sub_filter_name in enabled_sub_filters:
            sub_filter = _legacy_browsers_sub_filters.get(sub_filter_name)
            if sub_filter is not None and sub_filter(browser):
                return True

    return False


class _LegacyBrowserFilterSerializer(serializers.Serializer):
    active = serializers.BooleanField()
    subfilters = MultipleChoiceField(
        choices=[
            "ie_pre_9",
            "ie9",
            "ie10",
            "opera_pre_15",
            "android_pre_4",
            "safari_pre_6",
            "opera_mini_pre_8",
        ]
    )


_legacy_browsers_filter.spec = _FilterSpec(
    id=FilterStatKeys.LEGACY_BROWSER,
    name="Filter out known errors from legacy browsers",
    description="Older browsers often give less accurate information, and while they may report valid issues, "
    "the context to understand them is incorrect or missing.",
    serializer_cls=_LegacyBrowserFilterSerializer,
)


def _filter_default(browser):
    """
    Legacy filter - new users specify individual filters
    """
    try:
        minimum_version = MIN_VERSIONS[browser["family"]]
    except KeyError:
        return False

    try:
        major_browser_version = int(browser["major"])
    except (TypeError, ValueError):
        return False

    if minimum_version > major_browser_version:
        return True

    return False


def _filter_opera_pre_15(browser):
    if not browser["family"] == "Opera":
        return False

    try:
        major_browser_version = int(browser["major"])
    except (TypeError, ValueError):
        return False

    if major_browser_version < 15:
        return True

    return False


def _filter_safari_pre_6(browser):
    if not browser["family"] == "Safari":
        return False

    try:
        major_browser_version = int(browser["major"])
    except (TypeError, ValueError):
        return False

    if major_browser_version < 6:
        return True

    return False


def _filter_android_pre_4(browser):
    if not browser["family"] == "Android":
        return False

    try:
        major_browser_version = int(browser["major"])
    except (TypeError, ValueError):
        return False

    if major_browser_version < 4:
        return True

    return False


def _filter_opera_mini_pre_8(browser):
    if not browser["family"] == "Opera Mini":
        return False

    try:
        major_browser_version = int(browser["major"])
    except (TypeError, ValueError):
        return False

    if major_browser_version < 8:
        return True

    return False


def _filter_ie10(browser):
    return _filter_ie_internal(browser, lambda major_ver: major_ver == 10)


def _filter_ie9(browser):
    return _filter_ie_internal(browser, lambda major_ver: major_ver == 9)


def _filter_ie_pre_9(browser):
    return _filter_ie_internal(browser, lambda major_ver: major_ver <= 8)


def _filter_ie_internal(browser, compare_version):
    if not browser["family"] == "IE":
        return False

    try:
        major_browser_version = int(browser["major"])
    except (TypeError, ValueError):
        return False

    return compare_version(major_browser_version)


# list all browser specific sub filters that should be called
_legacy_browsers_sub_filters = {
    "default": _filter_default,
    "opera_pre_15": _filter_opera_pre_15,
    "safari_pre_6": _filter_safari_pre_6,
    "android_pre_4": _filter_android_pre_4,
    "opera_mini_pre_8": _filter_opera_mini_pre_8,
    "ie9": _filter_ie9,
    "ie10": _filter_ie10,
    "ie_pre_9": _filter_ie_pre_9,
}

# ************* web crawler filter *************

# not all of these agents are guaranteed to execute JavaScript, but to avoid
# overhead of identifying which ones do, and which ones will over time we simply
# target all of the major ones
_CRAWLERS = re.compile(
    r"|".join(
        (
            # Google spiders (Adsense and others)
            # https://support.google.com/webmasters/answer/1061943?hl=en
            r"Mediapartners\-Google",
            r"AdsBot\-Google",
            r"Googlebot",
            r"FeedFetcher\-Google",
            # Bing search
            r"BingBot",
            r"BingPreview",
            # Baidu search
            r"Baiduspider",
            # Yahoo
            r"Slurp",
            # Sogou
            r"Sogou",
            # facebook
            r"facebook",
            # Alexa
            r"ia_archiver",
            # Generic bot
            r"bots?[\/\s\)\;]",
            # Generic spider
            r"spider[\/\s\)\;]",
            # Slack - see https://api.slack.com/robots
            r"Slack",
            # Google indexing bot
            r"Calypso AppCrawler",
            # Pingdom
            r"pingdom",
            # Lytics
            r"lyticsbot",
        )
    ),
    re.I,
)


def _web_crawlers_filter(project_config, data):
    try:
        for key, value in get_path(data, "request", "headers", filter=True) or ():
            if key.lower() == "user-agent":
                if not value:
                    return False
                return bool(_CRAWLERS.search(value))
        return False
    except LookupError:
        return False


_web_crawlers_filter.spec = _FilterSpec(
    id=FilterStatKeys.WEB_CRAWLER,
    name="Filter out known web crawlers",
    description="Some crawlers may execute pages in incompatible ways which then cause errors that"
    " are unlikely to be seen by a normal user.",
)
