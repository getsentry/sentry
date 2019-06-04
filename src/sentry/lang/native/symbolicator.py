from __future__ import absolute_import

import sys
import jsonschema
import logging
import six
import time

from django.conf import settings
from django.core.urlresolvers import reverse

from requests.exceptions import RequestException
from six.moves.urllib.parse import urljoin

from sentry import options
from sentry.auth.system import get_system_token
from sentry.cache import default_cache
from sentry.utils import json, metrics
from sentry.net.http import Session
from sentry.tasks.store import RetrySymbolication

MAX_ATTEMPTS = 3
REQUEST_CACHE_TIMEOUT = 3600
SYMBOLICATOR_TIMEOUT = 5

logger = logging.getLogger(__name__)


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

    def _process(self, create_task):
        task_id = default_cache.get(self.task_id_cache_key)
        json = None

        with self.sess:
            try:
                if task_id:
                    # Processing has already started and we need to poll
                    # symbolicator for an update. This in turn may put us back into
                    # the queue.
                    json = self.sess.query_task(task_id)

                if json is None:
                    # This is a new task, so we compute all request parameters
                    # (potentially expensive if we need to pull minidumps), and then
                    # upload all information to symbolicator. It will likely not
                    # have a response ready immediately, so we start polling after
                    # some timeout.
                    json = create_task()
            except ServiceUnavailable:
                # 503 can indicate that symbolicator is restarting. Wait for a
                # reboot, then try again. This overrides the default behavior of
                # retrying after just a second.
                #
                # If there is no response attached, it's a connection error.
                raise RetrySymbolication(retry_after=10)

            metrics.incr('events.symbolicator.response', tags={
                'response': json.get('status') or 'null',
                'project_id': self.sess.project_id,
            })

            # Symbolication is still in progress. Bail out and try again
            # after some timeout. Symbolicator keeps the response for the
            # first one to poll it.
            if json['status'] == 'pending':
                default_cache.set(
                    self.task_id_cache_key,
                    json['request_id'],
                    REQUEST_CACHE_TIMEOUT)
                raise RetrySymbolication(retry_after=json['retry_after'])
            else:
                # Once we arrive here, we are done processing. Clean up the
                # task id from the cache.
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
    builtin_sources = project.get_option('sentry:builtin_symbol_sources')
    for key, source in six.iteritems(settings.SENTRY_BUILTIN_SOURCES):
        if key in builtin_sources:
            sources.append(source)

    return sources


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
                    # The symbolicator does not know this task. This is
                    # expected to happen when we're currently deploying
                    # symbolicator (which will clear all of its state). Re-send
                    # the symbolication task.
                    return None

                if response.status_code == 503:
                    raise ServiceUnavailable()

                response.raise_for_status()

                json = response.json()

                return json
            except (IOError, RequestException):
                attempts += 1
                # Any server error needs to be treated as a failure. We can
                # retry a couple of times, but ultimately need to bail out.
                #
                # This can happen for any network failure.
                if attempts > MAX_ATTEMPTS:
                    logger.error('Failed to contact symbolicator', exc_info=True)
                    raise

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
