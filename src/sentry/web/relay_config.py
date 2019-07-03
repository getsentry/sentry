from __future__ import absolute_import
import json

import six
import logging

from sentry.coreapi import APIError
from sentry.models.organizationoption import OrganizationOption
from sentry.models.project import Project
from sentry.models.organization import Organization
from sentry import options
from sentry.utils.data_filters import FilterTypes, FilterStatKeys
from sentry.utils.http import get_origins
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.models.projectoption import ProjectOption
from sentry.message_filters import get_all_filters

logger = logging.getLogger('sentry')

# a list of all the properties available in restricted config
_restricted_config_properties = frozenset([
    'project_id',

    'kafka_max_event_size',
    'kafka_raw_event_sample_rate'
])


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
        pieces = name.split('_')
        return first_lower(pieces[0]) + ''.join(first_upper(x) for x in pieces[1:])


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

    return {_to_camel_case_name(key): _to_camel_case_dict(value) if isinstance(value, dict) else value
            for (key, value) in six.iteritems(obj)}


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
        raise Exception("Trying to change read only RelayConfig object")

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
        return {key: value.to_dict() if isinstance(value, _ConfigBase) else value for (key, value) in
                six.iteritems(data)}

    def to_json_string(self):
        """
        >>> x = _ConfigBase( a = _ConfigBase(b = _ConfigBase( w=[1,2,3])))
        >>> x.to_json_string()
        '{"a": {"b": {"w": [1, 2, 3]}}}'

        :return:
        """
        data = self.to_dict()
        data = _to_camel_case_dict(data)
        return json.dumps(data)

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
        return object.__getattribute__(self, 'data')

    def __str__(self):
        try:
            return json.dumps(self.to_dict(), sort_keys=True)
        except Exception as e:
            return "Content Error:{}".format(e)

    def __repr__(self):
        return "({0}){1}".format(self.__class__.__name__, self)


class RestrictedConfig(_ConfigBase):
    """
    Represents the full configuration available to a trusted Relay processor
    """

    def to_restricted(self):
        return self


class FullRelayConfig(_ConfigBase):
    """
    Represents the restricted configuration available to an untrusted
    """

    def __init__(self, project, **kwargs):
        # TODO RaduW 20.05.2019 (ideally we would like to get rid of the project object), it is
        #   quite messy at the moment (it is added to the helper context so I don't really know where it ends up)
        #   For now just add it as a property (will not be serialized to JSON since it is not in the 'data' dictionary)
        object.__setattr__(self, "project", project)

        super(FullRelayConfig, self).__init__(**kwargs)

    def to_restricted(self):
        """
        Constructs a restricted Relay configuration for use on external (untrusted relay pipes)

        :return: a RestrictedConfig
        """
        all = self.to_dict()
        # keep only whitelisted properties for the Restricted conf
        restricted = {key: value for key, value in six.iteritems(all) if key in _restricted_config_properties}
        return RestrictedConfig(**restricted)


def get_full_relay_config(project_id):
    """
    Constructs the internal (big) RelayConfig

    :param project_id: the project id as int or string
    :return: FullRelayConfig the relay configuration
    """

    cfg = {}
    project = _get_project_from_id(six.text_type(project_id))

    if project is None:
        raise APIError("Invalid project id:{}".format(project_id))

    cfg['project_id'] = project.id
    cfg['organization_id'] = project.organization_id

    # Explicitly bind Organization so we don't implicitly query it later
    # this just allows us to comfortably assure that `project.organization` is safe.
    # This also allows us to pull the object from cache, instead of being
    # implicitly fetched from database.
    project.organization = Organization.objects.get_from_cache(
        id=project.organization_id)

    if project.organization is not None:
        org_options = OrganizationOption.objects.get_all_values(
            project.organization_id)
    else:
        org_options = {}

    # get the project options
    project_cfg = {}
    cfg['config'] = project_cfg

    # getting kafka info
    try:
        project_cfg['kafka_max_event_size'] = options.get('kafka-publisher.max-event-size')
        project_cfg['kafka_raw_event_sample_rate'] = options.get('kafka-publisher.raw-event-sample-rate')
    except Exception:
        pass  # should we log ?

    invalid_releases = project.get_option(u'sentry:{}'.format(FilterTypes.RELEASES))
    if invalid_releases is not None:
        project_cfg[FilterTypes.RELEASES] = invalid_releases

    blacklisted_ips = project.get_option('sentry:blacklisted_ips')
    if blacklisted_ips is not None:
        project_cfg['blacklisted_ips'] = blacklisted_ips

    error_messages = project.get_option(u'sentry:{}'.format(FilterTypes.ERROR_MESSAGES))
    if error_messages is not None:
        project_cfg[FilterTypes.ERROR_MESSAGES] = error_messages

    # get the filter settings for this project
    filter_settings = {}
    project_cfg['filter_settings'] = filter_settings

    for flt in get_all_filters():
        filter_id = flt.spec.id
        settings = _load_filter_settings(flt, project)
        filter_settings[filter_id] = settings

    scrub_ip_address = (org_options.get('sentry:require_scrub_ip_address', False) or
                        project.get_option('sentry:scrub_ip_address', False))

    project_cfg['scrub_ip_addresses'] = scrub_ip_address

    scrub_data = (org_options.get('sentry:require_scrub_data', False) or
                  project.get_option('sentry:scrub_data', True))

    project_cfg['scrub_data'] = scrub_data
    project_cfg['grouping_config'] = get_grouping_config_dict_for_project(project)
    project_cfg['allowed_domains'] = list(get_origins(project))

    if scrub_data:
        # We filter data immediately before it ever gets into the queue
        sensitive_fields_key = 'sentry:sensitive_fields'
        sensitive_fields = (
            org_options.get(sensitive_fields_key, []) +
            project.get_option(sensitive_fields_key, [])
        )
        project_cfg['sensitive_fields'] = sensitive_fields

        exclude_fields_key = 'sentry:safe_fields'
        exclude_fields = (
            org_options.get(exclude_fields_key, []) +
            project.get_option(exclude_fields_key, [])
        )
        project_cfg['exclude_fields'] = exclude_fields

        scrub_defaults = (org_options.get('sentry:require_scrub_defaults', False) or
                          project.get_option('sentry:scrub_defaults', True))
        project_cfg['scrub_defaults'] = scrub_defaults

    return FullRelayConfig(project, **cfg)


def _get_project_from_id(project_id):
    if not project_id:
        return None
    if not project_id.isdigit():
        track_outcome(0, 0, None, Outcome.INVALID, "project_id")
        raise APIError('Invalid project_id: %r' % project_id)
    try:
        return Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        track_outcome(0, 0, None, Outcome.INVALID, "project_id")
        raise APIError('Invalid project_id: %r' % project_id)


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
    filter_key = u'filters:{}'.format(filter_id)
    setting = ProjectOption.objects.get_value(project=project, key=filter_key, default=None)

    return _filter_option_to_config_setting(flt, setting)


def _filter_option_to_config_setting(flt, setting):
    """
    Encapsulates the logic for associating a filter database option with the filter setting from relay_config

    :param flt: the filter
    :param setting: the option deserialized from the database
    :return: the option as viewed from relay_config
    """
    if setting is None:
        raise ValueError("Could not find filter state for filter {0}."
                         " You need to register default filter state in projectoptions.defaults.".format(flt.spec.id))

    is_enabled = setting != '0'

    ret_val = {
        'is_enabled': is_enabled
    }

    # special case for legacy browser.
    # If the number of special cases increases we'll have to factor this functionality somewhere
    if flt.spec.id == FilterStatKeys.LEGACY_BROWSER:
        if is_enabled:
            if setting == '1':
                # old style filter
                ret_val['default_filter'] = True
            else:
                # new style filter, per legacy browser type handling
                # ret_val['options'] = setting.split(' ')
                ret_val['options'] = list(setting)
    return ret_val
