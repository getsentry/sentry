"""
sentry.coreapi
~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
# TODO: We should make the API a class, and UDP/HTTP just inherit from it
#       This will make it so we can more easily control logging with various
#       metadata (rather than generic log messages which aren't useful).
from __future__ import absolute_import, print_function

import base64
import jsonschema
import logging
import re
import six
import zlib

from collections import MutableMapping
from django.core.exceptions import SuspiciousOperation
from django.utils.crypto import constant_time_compare
from gzip import GzipFile
from six import BytesIO
from time import time

from sentry import filters
from sentry.cache import default_cache
from sentry.constants import VERSION_LENGTH
from sentry.interfaces.base import get_interface
from sentry.event_manager import EventManager
from sentry.models import ProjectKey
from sentry.tasks.store import preprocess_event, \
    preprocess_event_from_reprocessing
from sentry.utils import json
from sentry.utils.auth import parse_auth_header
from sentry.utils.http import origin_from_request
from sentry.utils.data_filters import is_valid_ip, \
    is_valid_release, is_valid_error_message, FilterStatKeys
from sentry.utils.strings import decompress

try:
    # Attempt to load ujson if it's installed.
    # It's advantageous to leverage here because this is
    # our primary data ingestion endpoint, and it's a
    # simple win. ujson differs from simplejson a bunch
    # so it's not worth utilizing it anywhere else.
    import ujson as json  # noqa
except ImportError:
    from sentry.utils import json

_dist_re = re.compile(r'^[a-zA-Z0-9_.-]+$')


class APIError(Exception):
    http_status = 400
    msg = 'Invalid request'
    name = None

    def __init__(self, msg=None, name=None):
        if msg:
            self.msg = msg
        if self.name:
            self.name = name

    def __str__(self):
        return self.msg or ''


class APIUnauthorized(APIError):
    http_status = 401
    msg = 'Unauthorized'


class APIForbidden(APIError):
    http_status = 403


class APIRateLimited(APIError):
    http_status = 429
    msg = 'Creation of this event was denied due to rate limiting'
    name = 'rate_limit'

    def __init__(self, retry_after=None):
        self.retry_after = retry_after


class Auth(object):
    def __init__(self, auth_vars, is_public=False):
        self.client = auth_vars.get('sentry_client')
        self.version = six.text_type(auth_vars.get('sentry_version'))
        self.secret_key = auth_vars.get('sentry_secret')
        self.public_key = auth_vars.get('sentry_key')
        self.is_public = is_public


class ClientContext(object):
    def __init__(self, agent=None, version=None, project_id=None, ip_address=None):
        # user-agent (i.e. raven-python)
        self.agent = agent
        # protocol version
        self.version = version
        # project instance
        self.project_id = project_id
        self.project = None
        self.ip_address = ip_address

    def bind_project(self, project):
        self.project = project
        self.project_id = project.id

    def bind_auth(self, auth):
        self.agent = auth.client
        self.version = auth.version

    def get_tags_context(self):
        return {'project': self.project_id, 'agent': self.agent, 'protocol': self.version}


class ClientLogHelper(object):
    def __init__(self, context):
        self.context = context
        self.logger = logging.getLogger('sentry.api')

    def debug(self, *a, **k):
        self.logger.debug(*a, **self._metadata(**k))

    def info(self, *a, **k):
        self.logger.info(*a, **self._metadata(**k))

    def warning(self, *a, **k):
        self.logger.warning(*a, **self._metadata(**k))

    def error(self, *a, **k):
        self.logger.error(*a, **self._metadata(**k))

    def _metadata(self, tags=None, extra=None, **kwargs):
        if not extra:
            extra = {}
        if not tags:
            tags = {}

        context = self.context

        project = context.project
        if project:
            project_label = '%s/%s' % (project.organization.slug, project.slug)
        else:
            project_label = 'id=%s' % (context.project_id, )

        tags.update(context.get_tags_context())
        tags['project'] = project_label

        extra['tags'] = tags
        extra['agent'] = context.agent
        extra['protocol'] = context.version
        extra['project'] = project_label

        kwargs['extra'] = extra

        return kwargs


class ClientApiHelper(object):
    def __init__(self, agent=None, version=None, project_id=None, ip_address=None):
        self.context = ClientContext(
            agent=agent,
            version=version,
            project_id=project_id,
            ip_address=ip_address,
        )
        self.log = ClientLogHelper(self.context)

    def auth_from_request(self, request):
        result = {k: request.GET[k] for k in six.iterkeys(
            request.GET) if k[:7] == 'sentry_'}

        if request.META.get('HTTP_X_SENTRY_AUTH', '')[:7].lower() == 'sentry ':
            if result:
                raise SuspiciousOperation(
                    'Multiple authentication payloads were detected.')
            result = parse_auth_header(request.META['HTTP_X_SENTRY_AUTH'])
        elif request.META.get('HTTP_AUTHORIZATION', '')[:7].lower() == 'sentry ':
            if result:
                raise SuspiciousOperation(
                    'Multiple authentication payloads were detected.')
            result = parse_auth_header(request.META['HTTP_AUTHORIZATION'])

        if not result:
            raise APIUnauthorized('Unable to find authentication information')

        origin = self.origin_from_request(request)
        auth = Auth(result, is_public=bool(origin))
        # default client to user agent
        if not auth.client:
            auth.client = request.META.get('HTTP_USER_AGENT')
        return auth

    def origin_from_request(self, request):
        """
        Returns either the Origin or Referer value from the request headers.
        """
        if request.META.get('HTTP_ORIGIN') == 'null':
            return 'null'
        return origin_from_request(request)

    def project_key_from_auth(self, auth):
        if not auth.public_key:
            raise APIUnauthorized('Invalid api key')

        # Make sure the key even looks valid first, since it's
        # possible to get some garbage input here causing further
        # issues trying to query it from cache or the database.
        if not ProjectKey.looks_like_api_key(auth.public_key):
            raise APIUnauthorized('Invalid api key')

        try:
            pk = ProjectKey.objects.get_from_cache(public_key=auth.public_key)
        except ProjectKey.DoesNotExist:
            raise APIUnauthorized('Invalid api key')

        # a secret key may not be present which will be validated elsewhere
        if not constant_time_compare(pk.secret_key, auth.secret_key or pk.secret_key):
            raise APIUnauthorized('Invalid api key')

        if not pk.is_active:
            raise APIUnauthorized('API key is disabled')

        if not pk.roles.store:
            raise APIUnauthorized('Key does not allow event storage access')

        return pk

    def project_id_from_auth(self, auth):
        return self.project_key_from_auth(auth).project_id

    def decode_data(self, encoded_data):
        try:
            return encoded_data.decode('utf-8')
        except UnicodeDecodeError as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.debug(six.text_type(e), exc_info=True)
            raise APIError('Bad data decoding request (%s, %s)' %
                           (type(e).__name__, e))

    def decompress_deflate(self, encoded_data):
        try:
            return zlib.decompress(encoded_data).decode('utf-8')
        except Exception as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.debug(six.text_type(e), exc_info=True)
            raise APIError('Bad data decoding request (%s, %s)' %
                           (type(e).__name__, e))

    def decompress_gzip(self, encoded_data):
        try:
            fp = BytesIO(encoded_data)
            try:
                f = GzipFile(fileobj=fp)
                return f.read().decode('utf-8')
            finally:
                f.close()
        except Exception as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.debug(six.text_type(e), exc_info=True)
            raise APIError('Bad data decoding request (%s, %s)' %
                           (type(e).__name__, e))

    def decode_and_decompress_data(self, encoded_data):
        try:
            try:
                return decompress(encoded_data).decode('utf-8')
            except zlib.error:
                return base64.b64decode(encoded_data).decode('utf-8')
        except Exception as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.debug(six.text_type(e), exc_info=True)
            raise APIError('Bad data decoding request (%s, %s)' %
                           (type(e).__name__, e))

    def safely_load_json_string(self, json_string):
        try:
            if isinstance(json_string, six.binary_type):
                json_string = json_string.decode('utf-8')
            obj = json.loads(json_string)
            assert isinstance(obj, dict)
        except Exception as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.debug(six.text_type(e), exc_info=True)
            raise APIError('Bad data reconstructing object (%s, %s)' %
                           (type(e).__name__, e))
        return obj

    def parse_client_as_sdk(self, value):
        if not value:
            return {}
        try:
            name, version = value.split('/', 1)
        except ValueError:
            try:
                name, version = value.split(' ', 1)
            except ValueError:
                return {}
        return {
            'name': name,
            'version': version,
        }

    def should_filter(self, project, data, ip_address=None):
        """
        returns (result: bool, reason: string or None)
        Result is True if an event should be filtered
        The reason for filtering is passed along as a string
        so that we can store it in metrics
        """
        if ip_address and not is_valid_ip(project, ip_address):
            return (True, FilterStatKeys.IP_ADDRESS)

        release = data.get('release')
        if release and not is_valid_release(project, release):
            return (True, FilterStatKeys.RELEASE_VERSION)

        message_interface = data.get('sentry.interfaces.Message', {})
        error_message = message_interface.get('formatted', ''
                                              ) or message_interface.get('message', '')
        if error_message and not is_valid_error_message(project, error_message):
            return (True, FilterStatKeys.ERROR_MESSAGE)

        for exception_interface in data.get('sentry.interfaces.Exception', {}).get('values', []):
            message = u': '.join(filter(None, map(exception_interface.get, ['type', 'value'])))
            if message and not is_valid_error_message(project, message):
                return (True, FilterStatKeys.ERROR_MESSAGE)

        for filter_cls in filters.all():
            filter_obj = filter_cls(project)
            if filter_obj.is_enabled() and filter_obj.test(data):
                return (True, six.text_type(filter_obj.id))

        return (False, None)

    def validate_data(self, data):
        return data

    def ensure_does_not_have_ip(self, data):
        if 'sentry.interfaces.Http' in data:
            if 'env' in data['sentry.interfaces.Http']:
                data['sentry.interfaces.Http']['env'].pop('REMOTE_ADDR', None)

        if 'sentry.interfaces.User' in data:
            data['sentry.interfaces.User'].pop('ip_address', None)

    def insert_data_to_database(self, data, start_time=None, from_reprocessing=False):
        if start_time is None:
            start_time = time()
        # we might be passed LazyData
        if isinstance(data, LazyData):
            data = dict(data.items())
        cache_key = 'e:{1}:{0}'.format(data['project'], data['event_id'])
        default_cache.set(cache_key, data, timeout=3600)
        task = from_reprocessing and \
            preprocess_event_from_reprocessing or preprocess_event
        task.delay(cache_key=cache_key, start_time=start_time,
                   event_id=data['event_id'])


class MinidumpApiHelper(ClientApiHelper):
    def origin_from_request(self, request):
        # We don't use an origin here
        return None

    def auth_from_request(self, request):
        key = request.GET.get('sentry_key')
        if not key:
            raise APIUnauthorized('Unable to find authentication information')

        auth = Auth({'sentry_key': key}, is_public=True)
        auth.client = 'sentry-minidump'
        return auth


class SecurityApiHelper(ClientApiHelper):

    report_interfaces = ('sentry.interfaces.Csp', 'hpkp')

    def origin_from_request(self, request):
        # In the case of security reports, the origin is not available at the
        # dispatch() stage, as we need to parse it out of the request body, so
        # we do our own CORS check once we have parsed it.
        return None

    def auth_from_request(self, request):
        key = request.GET.get('sentry_key')
        if not key:
            raise APIUnauthorized('Unable to find authentication information')

        auth = Auth(
            {
                'sentry_key': key,
            }, is_public=True
        )
        auth.client = request.META.get('HTTP_USER_AGENT')
        return auth

    def should_filter(self, project, data, ip_address=None):
        for name in self.report_interfaces:
            if name in data:
                interface = get_interface(name)
                if interface.to_python(data[name]).should_filter(project):
                    return (True, FilterStatKeys.INVALID_CSP)

        return super(SecurityApiHelper, self).should_filter(project, data, ip_address)

    def validate_data(self, data):
        try:
            interface = get_interface(data.pop('interface'))
            report = data.pop('report')
        except KeyError:
            raise APIForbidden('No report or interface data')

        # To support testing, we can either accept a buillt interface instance, or the raw data in
        # which case we build the instance ourselves
        try:
            instance = report if isinstance(report, interface) else interface.from_raw(report)
        except jsonschema.ValidationError as e:
            raise APIError('Invalid security report: %s' % str(e).splitlines()[0])

        def clean(d):
            return dict(filter(lambda x: x[1], d.items()))

        data.update({
            'logger': 'csp',
            'message': instance.get_message(),
            'culprit': instance.get_culprit(),
            instance.get_path(): instance.to_json(),
            'errors': [],

            'sentry.interfaces.User': {
                'ip_address': self.context.ip_address,
            },

            # Construct a faux Http interface based on the little information we have
            # This is a bit weird, since we don't have nearly enough
            # information to create an Http interface, but
            # this automatically will pick up tags for the User-Agent
            # which is actually important here for CSP
            'sentry.interfaces.Http': {
                'url': instance.get_origin(),
                'headers': clean({
                    'User-Agent': self.context.agent,
                    'Referer': instance.get_referrer(),
                })
            },
        })

        return data


class LazyData(MutableMapping):
    def __init__(self, data, content_encoding, helper, project, key, auth, client_ip):
        self._data = data
        self._content_encoding = content_encoding
        self._helper = helper
        self._project = project
        self._key = key
        self._auth = auth
        self._client_ip = client_ip
        self._decoded = False

    def _decode(self):
        data = self._data
        content_encoding = self._content_encoding
        helper = self._helper
        auth = self._auth

        # TODO(dcramer): CSP is passing already decoded JSON, which sort of
        # defeats the purpose of a lot of lazy evaluation. It needs refactored
        # to avoid doing that.
        if isinstance(data, six.binary_type):
            if content_encoding == 'gzip':
                data = helper.decompress_gzip(data)
            elif content_encoding == 'deflate':
                data = helper.decompress_deflate(data)
            elif data[0] != b'{':
                data = helper.decode_and_decompress_data(data)
            else:
                data = helper.decode_data(data)
        if isinstance(data, six.text_type):
            data = helper.safely_load_json_string(data)

        # We need data validation/etc to apply as part of LazyData so that
        # if there are filters present, they can operate on a normalized
        # version of the data

        # mutates data
        data = helper.validate_data(data)

        data['project'] = self._project.id
        data['key_id'] = self._key.id
        data['sdk'] = data.get('sdk') or helper.parse_client_as_sdk(auth.client)

        # mutates data
        manager = EventManager(data, version=auth.version)
        manager.normalize(request_env={
            'client_ip': self._client_ip,
            'auth': self._auth,
        })

        self._data = data
        self._decoded = True

    def __getitem__(self, name):
        if not self._decoded:
            self._decode()
        return self._data[name]

    def __setitem__(self, name, value):
        if not self._decoded:
            self._decode()
        self._data[name] = value

    def __delitem__(self, name):
        if not self._decoded:
            self._decode()
        del self._data[name]

    def __contains__(self, name):
        if not self._decoded:
            self._decode()
        return name in self._data

    def __len__(self):
        if not self._decoded:
            self._decode()
        return len(self._data)

    def __iter__(self):
        if not self._decoded:
            self._decode()
        return iter(self._data)
