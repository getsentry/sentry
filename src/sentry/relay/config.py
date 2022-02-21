import uuid
from datetime import datetime
from typing import Any, List, Mapping, Optional

from pytz import utc
from sentry_sdk import Hub, capture_exception

from sentry import features, quotas, utils
from sentry.constants import ObjectStatus
from sentry.datascrubbing import get_datascrubbing_settings, get_pii_config
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.ingest.inbound_filters import (
    FilterStatKeys,
    FilterTypes,
    get_all_filter_specs,
    get_filter_key,
)
from sentry.interfaces.security import DEFAULT_DISALLOWED_SOURCES
from sentry.models import Project
from sentry.relay.utils import to_camel_case_name
from sentry.utils import metrics
from sentry.utils.http import get_origins
from sentry.utils.sdk import configure_scope

#: These features will be listed in the project config
EXPOSABLE_FEATURES = [
    "organizations:metrics-extraction",
    "organizations:profiling",
]


def get_exposed_features(project: Project) -> List[str]:

    active_features = []
    for feature in EXPOSABLE_FEATURES:
        if feature.startswith("organizations:"):
            has_feature = features.has(feature, project.organization)
        elif feature.startswith("projects:"):
            has_feature = features.has(feature, project)
        else:
            raise RuntimeError("EXPOSABLE_FEATURES must start with 'organizations:' or 'projects:'")

        if has_feature:
            metrics.incr(
                "sentry.relay.config.features", tags={"outcome": "enabled", "feature": feature}
            )
            active_features.append(feature)
        else:
            metrics.incr(
                "sentry.relay.config.features", tags={"outcome": "disabled", "feature": feature}
            )

    return active_features


def get_project_key_config(project_key):
    """Returns a dict containing the information for a specific project key"""
    return {"dsn": project_key.dsn_public}


def get_public_key_configs(project, full_config, project_keys=None):
    public_keys = []

    for project_key in project_keys or ():
        key = {
            "publicKey": project_key.public_key,
            "numericId": project_key.id,
            # Disabled keys are omitted from the config, this is just there so
            # old Relays don't break (we haven't investigated whether there are
            # actual relays relying on this value)
            #
            # Removed that value in https://github.com/getsentry/relay/pull/778/files#diff-e66f275002251930fbfc361b4cca64ab41ff2435029f65c2fd6ffb729129909dL372
            "isEnabled": True,
        }

        if full_config:
            key["quotas"] = [
                q.to_json_legacy() for q in quotas.get_quotas(project, key=project_key)
            ]

        public_keys.append(key)

    return public_keys


def get_filter_settings(project):
    filter_settings = {}

    for flt in get_all_filter_specs():
        filter_id = get_filter_key(flt)
        settings = _load_filter_settings(flt, project)
        filter_settings[filter_id] = settings

    if features.has("projects:custom-inbound-filters", project):
        invalid_releases = project.get_option(f"sentry:{FilterTypes.RELEASES}")
        if invalid_releases:
            filter_settings["releases"] = {"releases": invalid_releases}

        error_messages = project.get_option(f"sentry:{FilterTypes.ERROR_MESSAGES}")
        if error_messages:
            filter_settings["errorMessages"] = {"patterns": error_messages}

    blacklisted_ips = project.get_option("sentry:blacklisted_ips")
    if blacklisted_ips:
        filter_settings["clientIps"] = {"blacklistedIps": blacklisted_ips}

    csp_disallowed_sources = []
    if bool(project.get_option("sentry:csp_ignored_sources_defaults", True)):
        csp_disallowed_sources += DEFAULT_DISALLOWED_SOURCES
    csp_disallowed_sources += project.get_option("sentry:csp_ignored_sources", [])
    if csp_disallowed_sources:
        filter_settings["csp"] = {"disallowedSources": csp_disallowed_sources}

    return filter_settings


def get_quotas(project, keys=None):
    return [quota.to_json() for quota in quotas.get_quotas(project, keys=keys)]


def get_project_config(project, full_config=True, project_keys=None):
    """
    Constructs the ProjectConfig information.

    :param project: The project to load configuration for. Ensure that
        organization is bound on this object; otherwise it will be loaded from
        the database.
    :param full_config: True if only the full config is required, False
        if only the restricted (for external relays) is required
        (default True, i.e. full configuration)
    :param project_keys: Pre-fetched project keys for performance. However, if
        no project keys are provided it is assumed that the config does not
        need to contain auth information (this is the case when used in
        python's StoreView)

    :return: a ProjectConfig object for the given project
    """
    with configure_scope() as scope:
        scope.set_tag("project", project.id)

    if project.status != ObjectStatus.VISIBLE:
        return ProjectConfig(project, disabled=True)

    public_keys = get_public_key_configs(project, full_config, project_keys=project_keys)

    with Hub.current.start_span(op="get_public_config"):
        now = datetime.utcnow().replace(tzinfo=utc)
        cfg = {
            "disabled": False,
            "slug": project.slug,
            "lastFetch": now,
            "lastChange": project.get_option("sentry:relay-rev-lastchange", now),
            "rev": project.get_option("sentry:relay-rev", uuid.uuid4().hex),
            "publicKeys": public_keys,
            "config": {
                "allowedDomains": list(get_origins(project)),
                "trustedRelays": [
                    r["public_key"]
                    for r in project.organization.get_option("sentry:trusted-relays", [])
                    if r
                ],
                "piiConfig": get_pii_config(project),
                "datascrubbingSettings": get_datascrubbing_settings(project),
                "features": get_exposed_features(project),
            },
            "organizationId": project.organization_id,
            "projectId": project.id,  # XXX: Unused by Relay, required by Python store
        }
    allow_dynamic_sampling = features.has(
        "organizations:filters-and-sampling",
        project.organization,
    )
    if allow_dynamic_sampling:
        dynamic_sampling = project.get_option("sentry:dynamic_sampling")
        if dynamic_sampling is not None:
            cfg["config"]["dynamicSampling"] = dynamic_sampling

    if not full_config:
        # This is all we need for external Relay processors
        return ProjectConfig(project, **cfg)

    if features.has("organizations:performance-ops-breakdown", project.organization):
        cfg["config"]["breakdownsV2"] = project.get_option("sentry:breakdowns")
    if features.has("organizations:transaction-metrics-extraction", project.organization):
        cfg["config"]["transactionMetrics"] = get_transaction_metrics_settings(
            project, cfg["config"].get("breakdownsV2")
        )
    if features.has("projects:performance-suspect-spans-ingestion", project=project):
        cfg["config"]["spanAttributes"] = project.get_option("sentry:span_attributes")
    with Hub.current.start_span(op="get_filter_settings"):
        cfg["config"]["filterSettings"] = get_filter_settings(project)
    with Hub.current.start_span(op="get_grouping_config_dict_for_project"):
        cfg["config"]["groupingConfig"] = get_grouping_config_dict_for_project(project)
    with Hub.current.start_span(op="get_event_retention"):
        cfg["config"]["eventRetention"] = quotas.get_event_retention(project.organization)
    with Hub.current.start_span(op="get_all_quotas"):
        cfg["config"]["quotas"] = get_quotas(project, keys=project_keys)

    return ProjectConfig(project, **cfg)


class _ConfigBase:
    """
    Base class for configuration objects

    Offers a readonly configuration class that can be serialized to json and viewed as a simple dictionary

    >>> x = _ConfigBase( a= 1, b="The b", c= _ConfigBase(x=33, y = _ConfigBase(m=3.14159 , w=[1,2,3], z={'t':1})))
    >>> x.a
    1
    >>> x.b
    'The b'
    >>> x.something is None # accessing non-existing elements
    True
    >>> x.c.y.w
    [1, 2, 3]

    """

    def __init__(self, **kwargs):
        data = {}
        object.__setattr__(self, "data", data)
        for (key, val) in kwargs.items():
            if val is not None:
                data[key] = val

    def __setattr__(self, key, value):
        raise Exception("Trying to change read only ProjectConfig object")

    def __getattr__(self, name):
        data = self.__get_data()
        return data.get(to_camel_case_name(name))

    def to_dict(self):
        """
        Converts the config object into a dictionary

        :return: A dictionary containing the object properties, with config properties also converted in dictionaries

        >>> x = _ConfigBase( a= 1, b="The b", c= _ConfigBase(x=33, y = _ConfigBase(m=3.14159 , w=[1,2,3], z={'t':1})))
        >>> x.to_dict() == {'a': 1, 'c': {'y': {'m': 3.14159, 'w': [1, 2, 3], 'z':{'t': 1}}, 'x': 33}, 'b': 'The b'}
        True
        """
        data = self.__get_data()
        return {
            key: value.to_dict() if isinstance(value, _ConfigBase) else value
            for (key, value) in data.items()
        }

    def to_json_string(self):
        """
        >>> x = _ConfigBase( a = _ConfigBase(b = _ConfigBase( w=[1,2,3])))
        >>> x.to_json_string()
        '{"a": {"b": {"w": [1, 2, 3]}}}'

        :return:
        """
        data = self.to_dict()
        return utils.json.dumps(data)

    def get_at_path(self, *args):
        """
        Gets an element at the specified path returning None if the element or the path doesn't exists

        :param args: the path to follow ( a list of strings)
        :return: the element if present at specified path or None otherwise)

        >>> x = _ConfigBase( a= 1, b="The b", c= _ConfigBase(x=33, y = _ConfigBase(m=3.14159 , w=[1,2,3], z={'t':1})))
        >>> x.get_at_path('c','y','m')
        3.14159
        >>> x.get_at_path('bb') is None # property not set
        True
        >>> x.get_at_path('a', 'something') is None # trying to go past existing Config paths
        True
        >>> x.get_at_path('c','y','z')
        {'t': 1}
        >>> x.get_at_path('c','y','z','t') is None # only navigates in ConfigBase does not try to go into normal dicts.
        True

        """
        if len(args) == 0:
            return self

        data = self.__get_data()
        val = data.get(args[0])

        if len(args) == 1:
            return val

        if isinstance(val, _ConfigBase):
            return val.get_at_path(*args[1:])

        return None  # property not set or path goes beyond the Config defined valid path

    def __get_data(self):
        return object.__getattribute__(self, "data")

    def __str__(self):
        try:
            return utils.json.dumps(self.to_dict(), sort_keys=True)
        except Exception as e:
            return f"Content Error:{e}"

    def __repr__(self):
        return f"({self.__class__.__name__}){self}"


class ProjectConfig(_ConfigBase):
    """
    Represents the restricted configuration available to an untrusted
    """

    def __init__(self, project, **kwargs):
        object.__setattr__(self, "project", project)

        super().__init__(**kwargs)


def _load_filter_settings(flt, project):
    """
    Returns the filter settings for the specified project

    :param flt: the filter function
    :param project: the project for which we want to retrieve the options
    :return: a dictionary with the filter options.
        If the project does not explicitly specify the filter options then the
        default options for the filter will be returned
    """
    filter_id = flt.id
    filter_key = f"filters:{filter_id}"
    setting = project.get_option(filter_key)

    return _filter_option_to_config_setting(flt, setting)


def _filter_option_to_config_setting(flt, setting):
    """
    Encapsulates the logic for associating a filter database option with the filter setting from project_config

    :param flt: the filter
    :param setting: the option deserialized from the database
    :return: the option as viewed from project_config
    """
    if setting is None:
        raise ValueError(
            "Could not find filter state for filter {}."
            " You need to register default filter state in projectoptions.defaults.".format(flt.id)
        )

    is_enabled = setting != "0"

    ret_val = {"isEnabled": is_enabled}

    # special case for legacy browser.
    # If the number of special cases increases we'll have to factor this functionality somewhere
    if flt.id == FilterStatKeys.LEGACY_BROWSER:
        if is_enabled:
            if setting == "1":
                ret_val["options"] = ["default"]
            else:
                # new style filter, per legacy browser type handling
                # ret_val['options'] = setting.split(' ')
                ret_val["options"] = list(setting)
    return ret_val


#: Top-level metrics for transactions
TRANSACTION_METRICS = frozenset(
    [
        "sentry.transactions.user",
        "sentry.transactions.transaction.duration",
    ]
)


ALL_MEASUREMENT_METRICS = frozenset(
    [
        "sentry.transactions.measurements.fp",
        "sentry.transactions.measurements.fcp",
        "sentry.transactions.measurements.lcp",
        "sentry.transactions.measurements.fid",
        "sentry.transactions.measurements.cls",
        "sentry.transactions.measurements.ttfb",
        "sentry.transactions.measurements.ttfb.requesttime",
        "sentry.transactions.measurements.app_start_cold",
        "sentry.transactions.measurements.app_start_warm",
        "sentry.transactions.measurements.frames_total",
        "sentry.transactions.measurements.frames_slow",
        "sentry.transactions.measurements.frames_frozen",
        "sentry.transactions.measurements.frames_slow_rate",
        "sentry.transactions.measurements.frames_frozen_rate",
        "sentry.transactions.measurements.stall_count",
        "sentry.transactions.measurements.stall_total_time",
        "sentry.transactions.measurements.stall_longest_time",
        "sentry.transactions.measurements.stall_percentage",
    ]
)


def get_transaction_metrics_settings(
    project: Project, breakdowns_config: Optional[Mapping[str, Any]]
):
    metrics = []
    custom_tags = []

    if features.has("organizations:transaction-metrics-extraction", project.organization):
        metrics.extend(sorted(TRANSACTION_METRICS))
        # TODO: for now let's extract all known measurements. we might want to
        # be more fine-grained in the future once we know which measurements we
        # really need (or how that can be dynamically determined)
        metrics.extend(sorted(ALL_MEASUREMENT_METRICS))

        if breakdowns_config is not None:
            # we already have a breakdown configuration that tells relay which
            # breakdowns to compute for an event. metrics extraction should
            # probably be in sync with that, or at least not extract more metrics
            # than there are breakdowns configured.
            try:
                for breakdown_name, breakdown_config in breakdowns_config.items():
                    assert breakdown_config["type"] == "spanOperations"

                    for op_name in breakdown_config["matches"]:
                        metrics.append(f"sentry.transactions.breakdowns.{breakdown_name}.{op_name}")
            except Exception:
                capture_exception()

        # Tells relay which user-defined tags to add to each extracted
        # transaction metric.  This cannot include things such as `os.name`
        # which are computed on the server, they have to come from the SDK as
        # event tags.
        try:
            custom_tags.extend(project.get_option("sentry:transaction_metrics_custom_tags") or ())
        except Exception:
            capture_exception()

    return {
        "extractMetrics": metrics,
        "extractCustomTags": custom_tags,
    }
