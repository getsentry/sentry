import logging
import uuid
from datetime import datetime, timezone
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Literal,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    TypedDict,
    Union,
)

import sentry_sdk
from pytz import utc
from sentry_sdk import Hub, capture_exception

from sentry import features, killswitches, options, quotas, utils
from sentry.constants import ObjectStatus
from sentry.datascrubbing import get_datascrubbing_settings, get_pii_config
from sentry.dynamic_sampling import generate_rules
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.ingest.inbound_filters import (
    FilterStatKeys,
    FilterTypes,
    _FilterSpec,
    get_all_filter_specs,
    get_filter_key,
)
from sentry.ingest.transaction_clusterer.meta import get_clusterer_meta
from sentry.ingest.transaction_clusterer.rules import (
    TRANSACTION_NAME_RULE_TTL_SECS,
    get_sorted_rules,
)
from sentry.interfaces.security import DEFAULT_DISALLOWED_SOURCES
from sentry.models import Project, ProjectKey
from sentry.relay.config.metric_extraction import get_metric_conditional_tagging_rules
from sentry.relay.utils import to_camel_case_name
from sentry.utils import metrics
from sentry.utils.http import get_origins
from sentry.utils.options import sample_modulo

from .measurements import CUSTOM_MEASUREMENT_LIMIT, get_measurements_config

#: These features will be listed in the project config
EXPOSABLE_FEATURES = [
    "projects:span-metrics-extraction",
    "organizations:transaction-name-mark-scrubbed-as-sanitized",
    "organizations:transaction-name-normalize",
    "organizations:profiling",
    "organizations:session-replay",
    "organizations:session-replay-recording-scrubbing",
    "organizations:device-class-synthesis",
]

EXTRACT_METRICS_VERSION = 1
EXTRACT_ABNORMAL_MECHANISM_VERSION = 2

#: How often the transaction clusterer should run before we trust its output as "complete",
#: and start marking all URL transactions as sanitized.
MIN_CLUSTERER_RUNS = 10

logger = logging.getLogger(__name__)


def get_exposed_features(project: Project) -> Sequence[str]:

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


def get_public_key_configs(
    project: Project, full_config: bool, project_keys: Optional[Sequence[ProjectKey]] = None
) -> List[Mapping[str, Any]]:
    public_keys: List[Mapping[str, Any]] = []
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

        public_keys.append(key)

    return public_keys


def get_filter_settings(project: Project) -> Mapping[str, Any]:
    filter_settings = {}

    for flt in get_all_filter_specs():
        filter_id = get_filter_key(flt)
        settings = _load_filter_settings(flt, project)
        if settings["isEnabled"]:
            filter_settings[filter_id] = settings

    error_messages: List[str] = []
    if features.has("projects:custom-inbound-filters", project):
        invalid_releases = project.get_option(f"sentry:{FilterTypes.RELEASES}")
        if invalid_releases:
            filter_settings["releases"] = {"releases": invalid_releases}

        error_messages += project.get_option(f"sentry:{FilterTypes.ERROR_MESSAGES}") or []

    enable_react = project.get_option("filters:react-hydration-errors")
    if enable_react:
        # 418 - Hydration failed because the initial UI does not match what was rendered on the server.
        # 419 - The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering.
        # 422 - There was an error while hydrating this Suspense boundary. Switched to client rendering.
        # 423 - There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.
        # 425 - Text content does not match server-rendered HTML.
        error_messages += [
            "*https://reactjs.org/docs/error-decoder.html?invariant={418,419,422,423,425}*"
        ]

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


def get_quotas(project: Project, keys: Optional[Sequence[ProjectKey]] = None) -> List[str]:
    try:
        computed_quotas = [quota.to_json() for quota in quotas.get_quotas(project, keys=keys)]
    except BaseException:
        metrics.incr("relay.config.get_quotas", tags={"success": False}, sample_rate=1.0)
        raise
    else:
        metrics.incr("relay.config.get_quotas", tags={"success": True}, sample_rate=1.0)
        return computed_quotas


def get_project_config(
    project: Project, full_config: bool = True, project_keys: Optional[Sequence[ProjectKey]] = None
) -> "ProjectConfig":
    """Constructs the ProjectConfig information.
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
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("project", project.id)
        with metrics.timer("relay.config.get_project_config.duration"):
            return _get_project_config(project, full_config=full_config, project_keys=project_keys)


def get_dynamic_sampling_config(project: Project) -> Optional[Mapping[str, Any]]:
    if features.has("organizations:dynamic-sampling", project.organization) and options.get(
        "dynamic-sampling:enabled-biases"
    ):
        # For compatibility reasons we want to return an empty list of old rules. This has been done in order to make
        # old Relays use empty configs which will result in them forwarding sampling decisions to upstream Relays.
        return {"rules": [], "rulesV2": generate_rules(project)}

    return None


class TransactionNameRuleScope(TypedDict):
    source: Literal["url"]


class TransactionNameRuleRedaction(TypedDict):
    method: Literal["replace"]
    substitution: str


class TransactionNameRule(TypedDict):
    pattern: str
    expiry: str
    scope: TransactionNameRuleScope
    redaction: TransactionNameRuleRedaction


def get_transaction_names_config(project: Project) -> Optional[Sequence[TransactionNameRule]]:
    if not features.has("organizations:transaction-name-normalize", project.organization):
        return None

    cluster_rules = get_sorted_rules(project)
    if not cluster_rules:
        return None

    return [_get_tx_name_rule(p, s) for p, s in cluster_rules]


def _get_tx_name_rule(pattern: str, seen_last: int) -> TransactionNameRule:
    rule_ttl = seen_last + TRANSACTION_NAME_RULE_TTL_SECS
    expiry_at = datetime.fromtimestamp(rule_ttl, tz=timezone.utc).isoformat()
    return TransactionNameRule(
        pattern=pattern,
        expiry=expiry_at,
        # Some more hardcoded fields for future compatibility. These are not
        # currently used.
        scope={"source": "url"},
        redaction={"method": "replace", "substitution": "*"},
    )


def add_experimental_config(
    config: MutableMapping[str, Any],
    key: str,
    function: Callable[..., Any],
    *args: Any,
    **kwargs: Any,
) -> None:
    """Try to set `config[key] = function(*args, **kwargs)`.
    If the result of the function call is None, the key is not set.
    If the function call raises an exception, we log it to sentry and the key remains unset.
    NOTE: Only use this function if you expect Relay to behave reasonably
    if ``key`` is missing from the config.
    """
    try:
        subconfig = function(*args, **kwargs)
    except Exception as e:
        sentry_sdk.capture_exception(e)
    else:
        if subconfig is not None:
            config[key] = subconfig


def _should_extract_abnormal_mechanism(project: Project) -> bool:
    return sample_modulo(
        "sentry-metrics.releasehealth.abnormal-mechanism-extraction-rate", project.organization_id
    )


def _get_project_config(
    project: Project, full_config: bool = True, project_keys: Optional[Sequence[ProjectKey]] = None
) -> "ProjectConfig":
    if project.status != ObjectStatus.ACTIVE:
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
            },
            "organizationId": project.organization_id,
            "projectId": project.id,  # XXX: Unused by Relay, required by Python store
        }

    config = cfg["config"]

    if exposed_features := get_exposed_features(project):
        config["features"] = exposed_features

    # NOTE: Omitting dynamicSampling because of a failure increases the number
    # of events forwarded by Relay, because dynamic sampling will stop filtering
    # anything.
    add_experimental_config(config, "dynamicSampling", get_dynamic_sampling_config, project)

    # Limit the number of custom measurements
    add_experimental_config(config, "measurements", get_measurements_config)

    # Rules to replace high cardinality transaction names
    add_experimental_config(config, "txNameRules", get_transaction_names_config, project)

    # Mark the project as ready if it has seen >= 10 clusterer runs.
    # This prevents projects from prematurely marking all URL transactions as sanitized.
    if get_clusterer_meta(project)["runs"] >= MIN_CLUSTERER_RUNS:
        config["txNameReady"] = True

    if not full_config:
        # This is all we need for external Relay processors
        return ProjectConfig(project, **cfg)

    config["breakdownsV2"] = project.get_option("sentry:breakdowns")

    if _should_extract_transaction_metrics(project):
        add_experimental_config(
            config,
            "transactionMetrics",
            get_transaction_metrics_settings,
            project,
            config.get("breakdownsV2"),
        )

        # This config key is technically not specific to _transaction_ metrics,
        # is however currently both only applied to transaction metrics in
        # Relay, and only used to tag transaction metrics in Sentry.
        add_experimental_config(
            config, "metricConditionalTagging", get_metric_conditional_tagging_rules, project
        )

    if features.has("organizations:metrics-extraction", project.organization):
        config["sessionMetrics"] = {
            "version": EXTRACT_ABNORMAL_MECHANISM_VERSION
            if _should_extract_abnormal_mechanism(project)
            else EXTRACT_METRICS_VERSION,
            "drop": features.has(
                "organizations:release-health-drop-sessions", project.organization
            ),
        }

    config["spanAttributes"] = project.get_option("sentry:span_attributes")
    with Hub.current.start_span(op="get_filter_settings"):
        if filter_settings := get_filter_settings(project):
            config["filterSettings"] = filter_settings
    with Hub.current.start_span(op="get_grouping_config_dict_for_project"):
        grouping_config = get_grouping_config_dict_for_project(project)
        if grouping_config is not None:
            config["groupingConfig"] = grouping_config
    with Hub.current.start_span(op="get_event_retention"):
        event_retention = quotas.get_event_retention(project.organization)
        if event_retention is not None:
            config["eventRetention"] = event_retention
    with Hub.current.start_span(op="get_all_quotas"):
        if quotas_config := get_quotas(project, keys=project_keys):
            config["quotas"] = quotas_config

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

    def __init__(self, **kwargs: Any) -> None:
        data: MutableMapping[str, Any] = {}
        object.__setattr__(self, "data", data)
        for (key, val) in kwargs.items():
            if val is not None:
                data[key] = val

    def __setattr__(self, key: str, value: Any) -> None:
        raise Exception("Trying to change read only ProjectConfig object")

    def __getattr__(self, name: str) -> Union[Any, Mapping[str, Any]]:
        data = self.__get_data()
        return data.get(to_camel_case_name(name))

    def to_dict(self) -> MutableMapping[str, Any]:
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

    def to_json_string(self) -> Any:
        """
        >>> x = _ConfigBase( a = _ConfigBase(b = _ConfigBase( w=[1,2,3])))
        >>> x.to_json_string()
        '{"a": {"b": {"w": [1, 2, 3]}}}'
        :return:
        """
        data = self.to_dict()
        return utils.json.dumps(data)

    def get_at_path(self, *args: str) -> Any:
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

    def __get_data(self) -> Mapping[str, Any]:
        return object.__getattribute__(self, "data")  # type: ignore

    def __str__(self) -> str:
        try:
            return utils.json.dumps(self.to_dict(), sort_keys=True)  # type: ignore
        except Exception as e:
            return f"Content Error:{e}"

    def __repr__(self) -> str:
        return f"({self.__class__.__name__}){self}"


class ProjectConfig(_ConfigBase):
    """
    Represents the restricted configuration available to an untrusted
    """

    def __init__(self, project: Project, **kwargs: Any) -> None:
        object.__setattr__(self, "project", project)

        super().__init__(**kwargs)


def _load_filter_settings(flt: _FilterSpec, project: Project) -> Mapping[str, Any]:
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


def _filter_option_to_config_setting(flt: _FilterSpec, setting: str) -> Mapping[str, Any]:
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

    ret_val: Dict[str, Union[bool, Sequence[str]]] = {"isEnabled": is_enabled}

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


#: Version of the transaction metrics extraction.
#: When you increment this version, outdated Relays will stop extracting
#: transaction metrics.
#: See https://github.com/getsentry/relay/blob/4f3e224d5eeea8922fe42163552e8f20db674e86/relay-server/src/metrics_extraction/transactions.rs#L71
TRANSACTION_METRICS_EXTRACTION_VERSION = 1


class CustomMeasurementSettings(TypedDict):
    limit: int


TransactionNameStrategy = Literal["strict", "clientBased"]


class TransactionMetricsSettings(TypedDict):
    version: int
    extractCustomTags: List[str]
    customMeasurements: CustomMeasurementSettings
    acceptTransactionNames: TransactionNameStrategy


def _should_extract_transaction_metrics(project: Project) -> bool:
    return features.has(
        "organizations:transaction-metrics-extraction", project.organization
    ) and not killswitches.killswitch_matches_context(
        "relay.drop-transaction-metrics", {"project_id": project.id}
    )


def get_transaction_metrics_settings(
    project: Project, breakdowns_config: Optional[Mapping[str, Any]]
) -> TransactionMetricsSettings:
    """This function assumes that the corresponding feature flag has been checked.
    See _should_extract_transaction_metrics.
    """
    custom_tags: List[str] = []

    if breakdowns_config is not None:
        # we already have a breakdown configuration that tells relay which
        # breakdowns to compute for an event. metrics extraction should
        # probably be in sync with that, or at least not extract more metrics
        # than there are breakdowns configured.
        try:
            for _, breakdown_config in breakdowns_config.items():
                assert breakdown_config["type"] == "spanOperations"

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
        "version": TRANSACTION_METRICS_EXTRACTION_VERSION,
        "extractCustomTags": custom_tags,
        "customMeasurements": {"limit": CUSTOM_MEASUREMENT_LIMIT},
        "acceptTransactionNames": "clientBased",
    }
