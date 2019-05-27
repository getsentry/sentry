from __future__ import absolute_import

import sys
import jsonschema
import logging
import six
import time

from django.core.urlresolvers import reverse

from requests.exceptions import RequestException
from six.moves.urllib.parse import urljoin

from sentry import options
from sentry.auth.system import get_system_token
from sentry.cache import default_cache
from sentry.lang.native.error import SymbolicationFailed, write_error
from sentry.lang.native.utils import image_name
from sentry.models.eventerror import EventError
from sentry.utils import json, metrics
from sentry.utils.in_app import is_known_third_party, is_optional_package
from sentry.net.http import Session
from sentry.tasks.store import RetrySymbolication

MAX_ATTEMPTS = 3
REQUEST_CACHE_TIMEOUT = 3600
SYMBOLICATOR_TIMEOUT = 5

logger = logging.getLogger(__name__)


BUILTIN_SOURCES = {
    'microsoft': {
        'type': 'http',
        'id': 'sentry:microsoft',
        'layout': {'type': 'symstore'},
        'filters': {
            'filetypes': ['pdb', 'pe'],
            'path_patterns': ['?:/windows/**']
        },
        'url': 'https://msdl.microsoft.com/download/symbols/',
        'is_public': True,
    },
    'citrix': {
        'type': 'http',
        'id': 'sentry:citrix',
        'layout': {'type': 'symstore'},
        'filters': {
            'filetypes': ['pdb', 'pe']
        },
        'url': 'http://ctxsym.citrix.com/symbols/',
        'is_public': True,
    },
    'intel': {
        'type': 'http',
        'id': 'sentry:intel',
        'layout': {'type': 'symstore'},
        'filters': {
            'filetypes': ['pdb', 'pe']
        },
        'url': 'https://software.intel.com/sites/downloads/symbols/',
        'is_public': True,
    },
    'amd': {
        'type': 'http',
        'id': 'sentry:amd',
        'layout': {'type': 'symstore'},
        'filters': {
            'filetypes': ['pdb', 'pe']
        },
        'url': 'https://download.amd.com/dir/bin/',
        'is_public': True,
    },
    'nvidia': {
        'type': 'http',
        'id': 'sentry:nvidia',
        'layout': {'type': 'symstore'},
        'filters': {
            'filetypes': ['pdb', 'pe']
        },
        'url': 'https://driver-symbols.nvidia.com/',
        'is_public': True,
    },
    'chromium': {
        'type': 'http',
        'id': 'sentry:chromium',
        'layout': {'type': 'symstore'},
        'filters': {
            'filetypes': ['pdb', 'pe']
        },
        'url': 'https://chromium-browser-symsrv.commondatastorage.googleapis.com/',
        'is_public': True,
    },
    'unity': {
        'type': 'http',
        'id': 'sentry:unity',
        'layout': {'type': 'symstore'},
        'filters': {
            'filetypes': ['pdb', 'pe']
        },
        'url': 'https://symbolserver.unity3d.com/',
        'is_public': True,
    },
    'mozilla': {
        'type': 'http',
        'id': 'sentry:mozilla',
        'layout': {'type': 'symstore'},
        'url': 'https://symbols.mozilla.org/',
        'is_public': True,
    },
    'autodesk': {
        'type': 'http',
        'id': 'sentry:autodesk',
        'layout': {'type': 'symstore'},
        'url': 'http://symbols.autodesk.com/',
        'is_public': True,
    }
}

VALID_LAYOUTS = (
    'native',
    'symstore',
)

VALID_FILE_TYPES = (
    'pe',
    'pdb',
    'mach_debug',
    'mach_code',
    'elf_debug',
    'elf_code',
    'breakpad',
)

VALID_CASINGS = (
    'lowercase',
    'uppercase',
    'default'
)

LAYOUT_SCHEMA = {
    'type': 'object',
    'properties': {
        'type': {
            'type': 'string',
            'enum': list(VALID_LAYOUTS),
        },
        'casing': {
            'type': 'string',
            'enum': list(VALID_CASINGS),
        },
    },
    'required': ['type'],
    'additionalProperties': False,
}

COMMON_SOURCE_PROPERTIES = {
    'id': {
        'type': 'string',
        'minLength': 1,
    },
    'layout': LAYOUT_SCHEMA,
    'filetypes': {
        'type': 'array',
        'items': {
            'type': 'string',
            'enum': list(VALID_FILE_TYPES),
        }
    },
}


S3_SOURCE_SCHEMA = {
    'type': 'object',
    'properties': dict(
        type={
            'type': 'string',
            'enum': ['s3'],
        },
        bucket={'type': 'string'},
        region={'type': 'string'},
        access_key={'type': 'string'},
        secret_key={'type': 'string'},
        prefix={'type': 'string'},
        **COMMON_SOURCE_PROPERTIES
    ),
    'required': ['type', 'id', 'bucket', 'region', 'access_key', 'secret_key', 'layout'],
    'additionalProperties': False,
}

SOURCES_SCHEMA = {
    'type': 'array',
    'items': {
        'oneOf': [
            # TODO: Implement HTTP sources
            S3_SOURCE_SCHEMA,
        ],
    }
}


IMAGE_STATUS_FIELDS = frozenset((
    'status',  # TODO(markus): Legacy key. Remove after next deploy
    'unwind_status',
    'debug_status'
))


class Symbolicator(object):
    def __init__(self, project, task_id_cache_key):
        symbolicator_options = options.get('symbolicator.options')
        base_url = symbolicator_options['url'].rstrip('/')
        assert base_url

        self.sess = SymbolicatorSession(
            url=base_url,
            project_id=six.text_type(project.id),
            timeout=SYMBOLICATOR_TIMEOUT,
            sources=get_sources_for_project(project)
        )

        self.task_id_cache_key = task_id_cache_key

    def _process(self, process_impl):
        task_id = default_cache.get(self.task_id_cache_key)

        with self.sess:
            if task_id:
                # Processing has already started and we need to poll
                # symbolicator for an update. This in turn may put us back into
                # the queue.
                try:
                    json = self.sess.query_task(task_id)
                except TaskIdNotFound:
                    # The symbolicator does not know this task. This is
                    # expected to happen when we're currently deploying
                    # symbolicator (which will clear all of its state). Re-send
                    # the symbolication task.
                    json = process_impl()
                except ServiceUnavailable:
                    # 503 can indicate that symbolicator is restarting. Wait for a
                    # reboot, then try again. This overrides the default behavior of
                    # retrying after just a second.
                    #
                    # If there is no response attached, it's a connection error.
                    raise RetrySymbolication(retry_after=10)

            else:
                # This is a new request, so we compute all request parameters
                # (potentially expensive if we need to pull minidumps), and then
                # upload all information to symbolicator. It will likely not
                # have a response ready immediately, so we start polling after
                # some timeout.
                json = process_impl()

            if json['status'] == 'pending':
                default_cache.set(
                    self.task_id_cache_key,
                    json['request_id'],
                    REQUEST_CACHE_TIMEOUT)
                raise RetrySymbolication(retry_after=json['retry_after'])
            else:
                default_cache.delete(self.task_id_cache_key)
                return json

    def process_minidump(self, minidump):
        return self._process(lambda: self.sess.upload_minidump(minidump))

    def process_payload(self, stacktraces, modules, signal=None):
        return self._process(lambda: self.sess.symbolicate_stacktraces(
            stacktraces=stacktraces, modules=modules, signal=signal))


class TaskIdNotFound(Exception):
    pass


class ServiceUnavailable(Exception):
    pass


class InvalidSourcesError(Exception):
    pass


def get_internal_source(project):
    """
    Returns the source configuration for a Sentry project.
    """
    internal_url_prefix = options.get('system.internal-url-prefix')
    if not internal_url_prefix:
        internal_url_prefix = options.get('system.url-prefix')
        if sys.platform == 'darwin':
            internal_url_prefix = internal_url_prefix \
                .replace("localhost", "host.docker.internal") \
                .replace("127.0.0.1", "host.docker.internal")

    assert internal_url_prefix
    sentry_source_url = '%s%s' % (
        internal_url_prefix.rstrip('/'),
        reverse('sentry-api-0-dsym-files', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug
        })
    )

    return {
        'type': 'sentry',
        'id': 'sentry:project',
        'url': sentry_source_url,
        'token': get_system_token(),
    }


def parse_sources(config):
    """
    Parses the given sources in the config string (from JSON).
    """

    if not config:
        return []

    try:
        sources = json.loads(config)
    except BaseException as e:
        raise InvalidSourcesError(e.message)

    try:
        jsonschema.validate(sources, SOURCES_SCHEMA)
    except jsonschema.ValidationError as e:
        raise InvalidSourcesError(e.message)

    ids = set()
    for source in sources:
        if source['id'].startswith('sentry'):
            raise InvalidSourcesError('Source ids must not start with "sentry:"')
        if source['id'] in ids:
            raise InvalidSourcesError('Duplicate source id: %s' % (source['id'], ))
        ids.add(source['id'])

    return sources


def get_sources_for_project(project):
    """
    Returns a list of symbol sources for this project.
    """

    sources = []

    # The symbolicator evaluates sources in the order they are declared. Always
    # try to download symbols from Sentry first.
    project_source = get_internal_source(project)
    sources.append(project_source)

    sources_config = project.get_option('sentry:symbol_sources')
    if sources_config:
        try:
            custom_sources = parse_sources(sources_config)
            sources.extend(custom_sources)
        except InvalidSourcesError:
            # Source configs should be validated when they are saved. If this
            # did not happen, this indicates a bug. Record this, but do not stop
            # processing at this point.
            logger.error('Invalid symbolicator source config', exc_info=True)

    # Add builtin sources last to ensure that custom sources have precedence
    # over our defaults.
    builtin_sources = project.get_option('sentry:builtin_symbol_sources') or []
    for key, source in six.iteritems(BUILTIN_SOURCES):
        if key in builtin_sources:
            sources.append(source)

    return sources


def handle_symbolicator_response_status(event_data, response_json):
    if not response_json:
        error = SymbolicationFailed(type=EventError.NATIVE_INTERNAL_FAILURE)
    elif response_json['status'] == 'completed':
        return True
    elif response_json['status'] == 'failed':
        error = SymbolicationFailed(message=response_json.get('message') or None,
                                    type=EventError.NATIVE_SYMBOLICATOR_FAILED)
    else:
        logger.error('Unexpected symbolicator status: %s', response_json['status'])
        error = SymbolicationFailed(type=EventError.NATIVE_INTERNAL_FAILURE)

    write_error(error, event_data)


def merge_symbolicator_image(raw_image, complete_image, sdk_info, handle_symbolication_failed):
    statuses = set()

    # Set image data from symbolicator as symbolicator might know more
    # than the SDK, especially for minidumps
    for k, v in six.iteritems(complete_image):
        if k in IMAGE_STATUS_FIELDS:
            statuses.add(v)
        elif not (v is None or (k, v) == ('arch', 'unknown')):
            raw_image[k] = v

    for status in set(statuses):
        handle_symbolicator_status(status, raw_image, sdk_info, handle_symbolication_failed)


def handle_symbolicator_status(status, image, sdk_info, handle_symbolication_failed):
    if status in ('found', 'unused'):
        return
    elif status in (
        'missing_debug_file',  # TODO(markus): Legacy key. Remove after next deploy
        'missing'
    ):
        package = image.get('code_file')
        # TODO(mitsuhiko): This check seems wrong?  This call seems to
        # mirror the one in the ios symbol server support.  If we change
        # one we need to change the other.
        if not package or is_known_third_party(package, sdk_info=sdk_info):
            return

        if is_optional_package(package, sdk_info=sdk_info):
            error = SymbolicationFailed(
                type=EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM)
        else:
            error = SymbolicationFailed(type=EventError.NATIVE_MISSING_DSYM)
    elif status in (
        'malformed_debug_file',  # TODO(markus): Legacy key. Remove after next deploy
        'malformed'
    ):
        error = SymbolicationFailed(type=EventError.NATIVE_BAD_DSYM)
    elif status == 'too_large':
        error = SymbolicationFailed(type=EventError.FETCH_TOO_LARGE)
    elif status == 'fetching_failed':
        error = SymbolicationFailed(type=EventError.FETCH_GENERIC_ERROR)
    elif status == 'other':
        error = SymbolicationFailed(type=EventError.UNKNOWN_ERROR)
    else:
        logger.error("Unknown status: %s", status)
        return

    error.image_arch = image.get('arch')
    error.image_path = image.get('code_file')
    error.image_name = image_name(image.get('code_file'))
    error.image_uuid = image.get('debug_id')
    handle_symbolication_failed(error)


class SymbolicatorSession(object):
    def __init__(self, url=None, sources=None, project_id=None, timeout=None):
        self.url = url
        self.project_id = project_id
        self.sources = sources or []
        self.timeout = timeout
        self.session = None

        self._query_params = {'timeout': timeout, 'scope': project_id}

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, *args):
        self.close()

    def open(self):
        if self.session is None:
            self.session = Session()

    def close(self):
        if self.session is not None:
            self.session.close()
            self.session = None

    def _ensure_open(self):
        if not self.session:
            raise RuntimeError('Session not opened')

    def _request(self, method, path, **kwargs):
        self._ensure_open()

        url = urljoin(self.url, path)

        # required for load balancing
        kwargs.setdefault('headers', {})['x-sentry-project-id'] = self.project_id

        attempts = 0
        wait = 0.5

        while True:
            try:
                response = self.session.request(method, url, **kwargs)

                metrics.incr('events.symbolicator.status_code', tags={
                    'status_code': response.status_code,
                    'project_id': self.project_id,
                })

                if (
                    method.lower() == 'get' and
                    path.startswith('requests/') and
                    response.status_code == 404
                ):
                    raise TaskIdNotFound()

                if response.status_code == 503:
                    raise ServiceUnavailable()

                response.raise_for_status()

                json = response.json()

                metrics.incr('events.symbolicator.response', tags={
                    'response': json.get('status') or 'null',
                    'project_id': self.project_id,
                })

                return json
            except (IOError, RequestException):
                attempts += 1
                if attempts > MAX_ATTEMPTS:
                    logger.error('Failed to contact symbolicator', exc_info=True)
                    return

                time.sleep(wait)
                wait *= 2.0

    def symbolicate_stacktraces(self, stacktraces, modules, signal=None):
        json = {
            'sources': self.sources,
            'stacktraces': stacktraces,
            'modules': modules,
        }

        if signal:
            json['signal'] = signal

        return self._request('post', 'symbolicate', params=self._query_params, json=json)

    def upload_minidump(self, minidump):
        files = {
            'upload_file_minidump': minidump
        }

        data = {
            'sources': json.dumps(self.sources),
        }

        return self._request('post', 'minidump', params=self._query_params, data=data, files=files)

    def query_task(self, task_id):
        task_url = 'requests/%s' % (task_id, )
        return self._request('get', task_url, params=self._query_params)

    def healthcheck(self):
        return self._request('get', 'healthcheck')
