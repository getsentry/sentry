from __future__ import absolute_import

import six
import uuid

from sentry_sdk import Hub

from datetime import datetime
from pytz import utc

from sentry import quotas, utils
from sentry.constants import ObjectStatus
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.interfaces.security import DEFAULT_DISALLOWED_SOURCES
from sentry.message_filters import get_all_filters
from sentry.models.organizationoption import OrganizationOption
from sentry.utils.safe import safe_execute
from sentry.utils.data_filters import FilterTypes, FilterStatKeys, get_filter_key
from sentry.utils.http import get_origins
from sentry.utils.sdk import configure_scope
from sentry.relay.utils import to_camel_case_name
from sentry.datascrubbing import merge_pii_configs


def get_project_key_config(project_key):
    """Returns a dict containing the information for a specific project key"""
    return {"dsn": project_key.dsn_public}


def get_public_key_configs(project, full_config, project_keys=None):
    public_keys = []

    for project_key in project_keys or ():
        key = {"publicKey": project_key.public_key, "isEnabled": project_key.status == 0}

        if full_config:
            key["quotas"] = [
                q.to_json_legacy() for q in quotas.get_quotas(project, key=project_key)
            ]
            key["numericId"] = project_key.id

        public_keys.append(key)

    return public_keys


def get_filter_settings(project):
    filter_settings = {}

    for flt in get_all_filters():
        filter_id = get_filter_key(flt)
        settings = _load_filter_settings(flt, project)
        filter_settings[filter_id] = settings

    invalid_releases = project.get_option(u"sentry:{}".format(FilterTypes.RELEASES))
    if invalid_releases:
        filter_settings["releases"] = {"releases": invalid_releases}

    blacklisted_ips = project.get_option("sentry:blacklisted_ips")
    if blacklisted_ips:
        filter_settings["clientIps"] = {"blacklistedIps": blacklisted_ips}

    error_messages = project.get_option(u"sentry:{}".format(FilterTypes.ERROR_MESSAGES))
    if error_messages:
        filter_settings["errorMessages"] = {"patterns": error_messages}

    csp_disallowed_sources = []
    if bool(project.get_option("sentry:csp_ignored_sources_defaults", True)):
        csp_disallowed_sources += DEFAULT_DISALLOWED_SOURCES
    csp_disallowed_sources += project.get_option("sentry:csp_ignored_sources", [])
    if csp_disallowed_sources:
        filter_settings["csp"] = {"disallowedSources": csp_disallowed_sources}

    return filter_settings


def get_quotas(project, keys=None):
    return [quota.to_json() for quota in quotas.get_quotas(project, keys=keys)]


def get_project_config(project, org_options=None, full_config=True, project_keys=None):
    """
    Constructs the ProjectConfig information.

    :param project: The project to load configuration for. Ensure that
        organization is bound on this object; otherwise it will be loaded from
        the database.
    :param org_options: Inject preloaded organization options for faster loading.
        If ``None``, options are lazy-loaded from the database.
    :param full_config: True if only the full config is required, False
        if only the restricted (for external relays) is required
        (default True, i.e. full configuration)
    :param project_keys: Pre-fetched project keys for performance, similar to
        org_options. However, if no project keys are provided it is assumed
        that the config does not need to contain auth information (this is the
        case when used in python's StoreView)

    :return: a ProjectConfig object for the given project
    """
    with configure_scope() as scope:
        scope.set_tag("project", project.id)

    if project.status != ObjectStatus.VISIBLE:
        return ProjectConfig(project, disabled=True)

    public_keys = get_public_key_configs(project, full_config, project_keys=project_keys)

    if org_options is None:
        org_options = OrganizationOption.objects.get_all_values(project.organization_id)

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
                "trustedRelays": org_options.get("sentry:trusted-relays", []),
                "piiConfig": _get_pii_config(project),
                "datascrubbingSettings": _get_datascrubbing_settings(project, org_options),
            },
            "projectId": project.id,  # XXX: Unused by Relay, required by Python store
        }

    if not full_config:
        # This is all we need for external Relay processors
        return ProjectConfig(project, **cfg)

    # The organization id is only required for reporting when processing events
    # internally. Do not expose it to external Relays.
    cfg["organizationId"] = project.organization_id

    with Hub.current.start_span(op="get_filter_settings"):
        cfg["config"]["filterSettings"] = get_filter_settings(project)
    with Hub.current.start_span(op="get_grouping_config_dict_for_project"):
        cfg["config"]["groupingConfig"] = get_grouping_config_dict_for_project(project)
    with Hub.current.start_span(op="get_event_retention"):
        cfg["config"]["eventRetention"] = quotas.get_event_retention(project.organization)
    with Hub.current.start_span(op="get_all_quotas"):
        cfg["config"]["quotas"] = get_quotas(project, keys=project_keys)

    return ProjectConfig(project, **cfg)


class _ConfigBase(object):
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
        for (key, val) in six.iteritems(kwargs):
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
            for (key, value) in six.iteritems(data)
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
            return "Content Error:{}".format(e)

    def __repr__(self):
        return "({0}){1}".format(self.__class__.__name__, self)


class ProjectConfig(_ConfigBase):
    """
    Represents the restricted configuration available to an untrusted
    """

    def __init__(self, project, **kwargs):
        object.__setattr__(self, "project", project)

        super(ProjectConfig, self).__init__(**kwargs)


def _get_pii_config(project):
    def _decode(value):
        if value:
            return safe_execute(utils.json.loads, value)

    # Order of merging is important here. We want to apply organization rules
    # before project rules. For example:
    #
    # * Organization rule: remove substrings "mypassword"
    # * Project rule: remove substrings "my"
    #
    # If we were to apply project rules before organization rules, "password"
    # would leak. We effectively disabled an organization rule using a project rule.
    #
    # Of course organization rules can also break project rules the same way,
    # but we communicate in the UI that organization options take precedence
    # here.
    return merge_pii_configs(
        [
            ("organization:", _decode(project.organization.get_option("sentry:relay_pii_config"))),
            ("project:", _decode(project.get_option("sentry:relay_pii_config"))),
        ]
    )


def _get_datascrubbing_settings(project, org_options):
    rv = {}

    exclude_fields_key = "sentry:safe_fields"
    rv["excludeFields"] = org_options.get(exclude_fields_key, []) + project.get_option(
        exclude_fields_key, []
    )

    rv["scrubData"] = org_options.get("sentry:require_scrub_data", False) or project.get_option(
        "sentry:scrub_data", True
    )

    rv["scrubIpAddresses"] = org_options.get(
        "sentry:require_scrub_ip_address", False
    ) or project.get_option("sentry:scrub_ip_address", False)

    sensitive_fields_key = "sentry:sensitive_fields"
    rv["sensitiveFields"] = org_options.get(sensitive_fields_key, []) + project.get_option(
        sensitive_fields_key, []
    )

    rv["scrubDefaults"] = org_options.get(
        "sentry:require_scrub_defaults", False
    ) or project.get_option("sentry:scrub_defaults", True)

    return rv


def _load_filter_settings(flt, project):
    """
    Returns the filter settings for the specified project

    :param flt: the filter function
    :param project: the project for which we want to retrieve the options
    :return: a dictionary with the filter options.
        If the project does not explicitly specify the filter options then the
        default options for the filter will be returned
    """
    filter_id = flt.spec.id
    filter_key = u"filters:{}".format(filter_id)
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
            "Could not find filter state for filter {0}."
            " You need to register default filter state in projectoptions.defaults.".format(
                flt.spec.id
            )
        )

    is_enabled = setting != "0"

    ret_val = {"isEnabled": is_enabled}

    # special case for legacy browser.
    # If the number of special cases increases we'll have to factor this functionality somewhere
    if flt.spec.id == FilterStatKeys.LEGACY_BROWSER:
        if is_enabled:
            if setting == "1":
                ret_val["options"] = ["default"]
            else:
                # new style filter, per legacy browser type handling
                # ret_val['options'] = setting.split(' ')
                ret_val["options"] = list(setting)
    return ret_val
