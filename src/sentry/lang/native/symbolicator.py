from __future__ import absolute_import

import sys
import jsonschema
import logging
import six
import time

from django.core.urlresolvers import reverse

from requests.exceptions import RequestException

from sentry import options
from sentry.auth.system import get_system_token
from sentry.cache import default_cache
from sentry.lang.native.symbolizer import SymbolicationFailed
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


def run_symbolicator(stacktraces, modules, project, arch, signal, request_id_cache_key):
    symbolicator_options = options.get('symbolicator.options')
    base_url = symbolicator_options['url'].rstrip('/')
    assert base_url

    project_id = six.text_type(project.id)
    request_id = default_cache.get(request_id_cache_key)
    sess = Session()

    # Will be set lazily when a symbolicator request is fired
    sources = None

    attempts = 0
    wait = 0.5

    with sess:
        while True:
            try:
                if request_id:
                    rv = _poll_symbolication_task(
                        sess=sess, base_url=base_url,
                        request_id=request_id
                    )
                else:
                    if sources is None:
                        sources = get_sources_for_project(project)

                    rv = _create_symbolication_task(
                        sess=sess, base_url=base_url,
                        project_id=project_id, sources=sources,
                        signal=signal, stacktraces=stacktraces, modules=modules
                    )

                metrics.incr('events.symbolicator.status_code', tags={
                    'status_code': rv.status_code,
                    'project_id': project_id,
                })

                if rv.status_code == 404 and request_id:
                    default_cache.delete(request_id_cache_key)
                    request_id = None
                    continue
                elif rv.status_code == 503:
                    raise RetrySymbolication(retry_after=10)

                rv.raise_for_status()
                json = rv.json()
                metrics.incr('events.symbolicator.response', tags={
                    'response': json['status'],
                    'project_id': project_id,
                })

                if json['status'] == 'pending':
                    default_cache.set(
                        request_id_cache_key,
                        json['request_id'],
                        REQUEST_CACHE_TIMEOUT)
                    raise RetrySymbolication(retry_after=json['retry_after'])
                elif json['status'] == 'completed':
                    default_cache.delete(request_id_cache_key)
                    return rv.json()
                else:
                    logger.error("Unexpected status: %s", json['status'])

                    default_cache.delete(request_id_cache_key)
                    return

            except (IOError, RequestException):
                attempts += 1
                if attempts > MAX_ATTEMPTS:
                    logger.error('Failed to contact symbolicator', exc_info=True)

                    default_cache.delete(request_id_cache_key)
                    return

                time.sleep(wait)
                wait *= 2.0


def _poll_symbolication_task(sess, base_url, request_id):
    url = '{base_url}/requests/{request_id}?timeout={timeout}'.format(
        base_url=base_url,
        request_id=request_id,
        timeout=SYMBOLICATOR_TIMEOUT,
    )
    return sess.get(url)


def _create_symbolication_task(sess, base_url, project_id, sources,
                               signal, stacktraces, modules):
    request = {
        'signal': signal,
        'sources': sources,
        'request': {
            'timeout': SYMBOLICATOR_TIMEOUT,
        },
        'stacktraces': stacktraces,
        'modules': modules,
    }
    url = '{base_url}/symbolicate?timeout={timeout}&scope={scope}'.format(
        base_url=base_url,
        timeout=SYMBOLICATOR_TIMEOUT,
        scope=project_id,
    )
    return sess.post(url, json=request)


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
