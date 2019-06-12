from __future__ import absolute_import
import json

import six
import logging

from copy import copy

from sentry.coreapi import APIError
from sentry.models.organizationoption import OrganizationOption
from sentry.models.project import Project
from sentry.models.organization import Organization
from sentry import options
from sentry.utils.data_filters import FilterTypes
from sentry.utils.http import get_origins
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry import filters

logger = logging.getLogger('sentry')

# a list of all the properties available in restricted config
_restricted_config_properties = frozenset([
    'project_id',

    'kafka_max_event_size',
    'kafka_raw_event_sample_rate'
])


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

        :return: A dictionary containing the object properties, with config properties also converted in dictionaries

        >>> x = _ConfigBase( a= 1, b="The b", c= _ConfigBase(x=33, y = _ConfigBase(m=3.14159 , w=[1,2,3], z={'t':1})))
        >>> x.to_dict() == {'a': 1, 'c': {'y': {'m': 3.14159, 'w': [1, 2, 3], 'z':{'t': 1}}, 'x': 33}, 'b': 'The b'}
        True
        """
        data = self.__get_data()
        cp = copy(data)  # copy so that we don't override inner RelayConfig objects

        for (key, val) in six.iteritems(cp):
            if isinstance(val, _ConfigBase):
                cp[key] = val.to_dict()
        return cp

    def to_json_string(self):
        """
        >>> x = _ConfigBase( a = _ConfigBase(b = _ConfigBase( w=[1,2,3])))
        >>> x.to_json_string()
        '{"a": {"b": {"w": [1, 2, 3]}}}'

        :return:
        """
        data = self.to_dict()
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
        >>> x.get_at_path('c','y','z','t') is None # only navigates in ConfigBase does not try to go into normal
        dictionaries
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
        project_cfg['invalid_releases'] = invalid_releases

    # get the filters enabled for the current project
    enabled_filters = [filter_class.id for filter_class in filters.all()
                       if filter_class(project).is_enabled()]

    project_cfg['enabled_filters'] = enabled_filters

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
