from __future__ import absolute_import

import six
import uuid
import sentry.utils as utils

from datetime import datetime
from pytz import utc

from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.interfaces.security import DEFAULT_DISALLOWED_SOURCES
from sentry.message_filters import get_all_filters, get_filter_key
from sentry import quotas

from sentry.models.organizationoption import OrganizationOption
from sentry.utils.data_filters import FilterTypes, FilterStatKeys
from sentry.utils.http import get_origins
from sentry.models.projectkey import ProjectKey
from sentry.utils.sdk import configure_scope


def get_project_key_config(project_key):
    """Returns a dict containing the information for a specific project key"""
    return {"dsn": project_key.dsn_public}


def get_project_config(project, org_options=None, full_config=True, for_store=False):
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
    :param for_store: If set to true, this omits all parameters that are not
        needed for Relay. This is a temporary flag that should be removed once
        store has been moved to Relay. Most importantly, this avoids database
        accesses.

    :return: a ProjectConfig object for the given project
    """
    with configure_scope() as scope:
        scope.set_tag("project", project.id)

    if for_store:
        project_keys = []
    else:
        project_keys = ProjectKey.objects.filter(project=project).all()

    public_keys = []

    for project_key in project_keys:
        key = {"publicKey": project_key.public_key, "isEnabled": project_key.status == 0}
        if full_config:
            key["numericId"] = project_key.id

            key["quotas"] = [
                quota.to_json() for quota in quotas.get_quotas(project, key=project_key)
            ]
        public_keys.append(key)

    now = datetime.utcnow().replace(tzinfo=utc)

    if org_options is None:
        org_options = OrganizationOption.objects.get_all_values(project.organization_id)

    cfg = {
        "disabled": project.status > 0,
        "slug": project.slug,
        "lastFetch": now,
        "lastChange": project.get_option("sentry:relay-rev-lastchange", now),
        "rev": project.get_option("sentry:relay-rev", uuid.uuid4().hex),
        "publicKeys": public_keys,
        "config": {
            "allowedDomains": project.get_option("sentry:origins", ["*"]),
            "trustedRelays": org_options.get("sentry:trusted-relays", []),
            "piiConfig": _get_pii_config(project),
            "datascrubbingSettings": _get_datascrubbing_settings(project, org_options),
        },
        "project_id": project.id,
    }

    if not full_config:
        # This is all we need for external Relay processors
        return ProjectConfig(project, **cfg)

    # The organization id is only required for reporting when processing events
    # internally. Do not expose it to external Relays.
    cfg["organization_id"] = project.organization_id

    project_cfg = cfg["config"]

    # get the filter settings for this project
    filter_settings = {}
    project_cfg["filter_settings"] = filter_settings

    for flt in get_all_filters():
        filter_id = get_filter_key(flt)
        settings = _load_filter_settings(flt, project)
        filter_settings[filter_id] = settings

    invalid_releases = project.get_option(u"sentry:{}".format(FilterTypes.RELEASES))
    if invalid_releases:
        filter_settings[FilterTypes.RELEASES] = {"releases": invalid_releases}

    blacklisted_ips = project.get_option("sentry:blacklisted_ips")
    if blacklisted_ips:
        filter_settings["client_ips"] = {"blacklisted_ips": blacklisted_ips}

    error_messages = project.get_option(u"sentry:{}".format(FilterTypes.ERROR_MESSAGES))
    if error_messages:
        filter_settings[FilterTypes.ERROR_MESSAGES] = {"patterns": error_messages}

    csp_disallowed_sources = []
    if bool(project.get_option("sentry:csp_ignored_sources_defaults", True)):
        csp_disallowed_sources += DEFAULT_DISALLOWED_SOURCES
    csp_disallowed_sources += project.get_option("sentry:csp_ignored_sources", [])
    if csp_disallowed_sources:
        filter_settings["csp"] = {"disallowed_sources": csp_disallowed_sources}

    scrub_ip_address = org_options.get(
        "sentry:require_scrub_ip_address", False
    ) or project.get_option("sentry:scrub_ip_address", False)

    project_cfg["scrub_ip_addresses"] = scrub_ip_address

    project_cfg["grouping_config"] = get_grouping_config_dict_for_project(project)
    project_cfg["allowed_domains"] = list(get_origins(project))

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
        return data.get(name)

    def to_dict(self):
        """
        Converts the config object into a dictionary

        :param to_camel_case: should the dictionary keys be converted to camelCase from snake_case
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

    def to_camel_case_dict(self):
        return _to_camel_case_dict(self.to_dict())

    def to_json_string(self):
        """
        >>> x = _ConfigBase( a = _ConfigBase(b = _ConfigBase( w=[1,2,3])))
        >>> x.to_json_string()
        '{"a": {"b": {"w": [1, 2, 3]}}}'

        :return:
        """
        data = self.to_dict()
        data = _to_camel_case_dict(data)
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
    value = project.get_option("sentry:relay_pii_config")
    if value is not None:
        try:
            return utils.json.loads(value)
        except (TypeError, ValueError):
            return None


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


def _to_camel_case_name(name):
    """
    Converts a string from snake_case to camelCase

    :param name: the string to convert
    :return: the name converted to camelCase

    >>> _to_camel_case_name(22)
    22
    >>> _to_camel_case_name("hello_world")
    'helloWorld'
    >>> _to_camel_case_name("_hello_world")
    'helloWorld'
    >>> _to_camel_case_name("__hello___world___")
    'helloWorld'
    >>> _to_camel_case_name("hello")
    'hello'
    >>> _to_camel_case_name("Hello_world")
    'helloWorld'
    >>> _to_camel_case_name("one_two_three_four")
    'oneTwoThreeFour'
    >>> _to_camel_case_name("oneTwoThreeFour")
    'oneTwoThreeFour'
    """

    def first_lower(s):
        return s[:1].lower() + s[1:]

    def first_upper(s):
        return s[:1].upper() + s[1:]

    if not isinstance(name, six.string_types):
        return name
    else:
        name = name.strip("_")
        pieces = name.split("_")
        return first_lower(pieces[0]) + "".join(first_upper(x) for x in pieces[1:])


def _to_camel_case_dict(obj):
    """
    Converts recursively the keys of a dictionary from snake_case to camelCase

    This is intended for converting dictionaries that use the python convention to
    dictionaries that use the javascript/JSON convention

    NOTE: this function will, by default,  mutate the dictionary in place.
    If you do not want to change the input use clone=True

    :param obj: the dictionary

    :return: a dictionary with the string keys converted

    >>> _to_camel_case_dict({'_abc': {'_one_two_three': 1}})
    {'abc': {'oneTwoThree': 1}}
    >>> val = {'_abc': {'_one_two_three': 1}}
    >>> _to_camel_case_dict({'_abc': {'_one_two_three': 1}})
    {'abc': {'oneTwoThree': 1}}

    # check that we didn't affect the original
    >>> val
    {'_abc': {'_one_two_three': 1}}

    """

    if not isinstance(obj, dict):
        raise ValueError("Bad parameter passed expected dictionary got {}".format(repr(type(obj))))

    return {
        _to_camel_case_name(key): _to_camel_case_dict(value) if isinstance(value, dict) else value
        for (key, value) in six.iteritems(obj)
    }


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

    ret_val = {"is_enabled": is_enabled}

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
