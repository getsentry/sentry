from __future__ import absolute_import, print_function

__all__ = ['SourceProcessor']

import logging
import hashlib
import re
import base64

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from collections import namedtuple
from OpenSSL.SSL import ZeroReturnError
from os.path import splitext
from requests.exceptions import RequestException
from simplejson import JSONDecodeError
from urlparse import urlparse, urljoin, urlsplit

from sentry import http
from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.interfaces.stacktrace import Stacktrace
from sentry.models import Project, Release, ReleaseFile
from sentry.utils.cache import cache
from sentry.utils.http import is_valid_origin
from sentry.utils.strings import truncatechars

from .cache import SourceCache, SourceMapCache
from .sourcemaps import sourcemap_to_index, find_source


# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5
BASE64_SOURCEMAP_PREAMBLE = 'data:application/json;base64,'
BASE64_PREAMBLE_LENGTH = len(BASE64_SOURCEMAP_PREAMBLE)
UNKNOWN_MODULE = '<unknown module>'
CLEAN_MODULE_RE = re.compile(r"""^
(?:/|  # Leading slashes
(?:
    (?:java)?scripts?|js|build|static|node_modules|bower_components|[_\.].*?|  # common folder prefixes
    v?(?:\d+\.)*\d+|   # version numbers, v1, 1.0.0
    [a-f0-9]{7,8}|     # short sha
    [a-f0-9]{32}|      # md5
    [a-f0-9]{40}       # sha1
)/)+|
(?:[-\.][a-f0-9]{7,}$)  # Ending in a commitish
""", re.X | re.I)
# the maximum number of remote resources (i.e. sourc eifles) that should be
# fetched
MAX_RESOURCE_FETCHES = 100

# TODO(dcramer): we want to change these to be constants so they are easier
# to translate/link again
ERR_DOMAIN_BLACKLISTED = 'The domain has been temporarily blacklisted due to previous failures:\n{reason}.'
ERR_GENERIC_FETCH_FAILURE = 'A {type} error was hit while fetching the source'
ERR_HTTP_CODE = 'Received HTTP {status_code} response'
ERR_NO_COLUMN = 'No column information available (cant expand sourcemap)'
ERR_MISSING_SOURCE = 'Source was not found: {filename}'
ERR_SOURCEMAP_UNPARSEABLE = 'Sourcemap was not parseable (likely invalid JSON)'
ERR_TOO_MANY_REMOTE_SOURCES = 'Not fetching context due to too many remote sources'
ERR_UNKNOWN_INTERNAL_ERROR = 'An unknown internal error occurred while attempting to fetch the source'

UrlResult = namedtuple('UrlResult', ['url', 'headers', 'body'])

logger = logging.getLogger(__name__)


class BadSource(Exception):
    pass


class DomainBlacklisted(BadSource):
    pass


class CannotFetchSource(BadSource):
    pass


class UnparseableSourcemap(BadSource):
    pass


def trim_line(line, column=0):
    """
    Trims a line down to a goal of 140 characters, with a little
    wiggle room to be sensible and tries to trim around the given
    `column`. So it tries to extract 60 characters before and after
    the provided `column` and yield a better context.
    """
    line = line.strip('\n')
    ll = len(line)
    if ll <= 150:
        return line
    if column > ll:
        column = ll
    start = max(column - 60, 0)
    # Round down if it brings us close to the edge
    if start < 5:
        start = 0
    end = min(start + 140, ll)
    # Round up to the end if it's close
    if end > ll - 5:
        end = ll
    # If we are bumped all the way to the end,
    # make sure we still get a full 140 characters in the line
    if end == ll:
        start = max(end - 140, 0)
    line = line[start:end]
    if end < ll:
        # we've snipped from the end
        line += ' {snip}'
    if start > 0:
        # we've snipped from the beginning
        line = '{snip} ' + line
    return line


def get_source_context(source, lineno, colno, context=LINES_OF_CONTEXT):
    if not source:
        return [], '', []

    # lineno's in JS are 1-indexed
    # just in case. sometimes math is hard
    if lineno > 0:
        lineno -= 1

    lower_bound = max(0, lineno - context)
    upper_bound = min(lineno + 1 + context, len(source))

    try:
        pre_context = map(trim_line, source[lower_bound:lineno])
    except IndexError:
        pre_context = []

    try:
        context_line = trim_line(source[lineno], colno)
    except IndexError:
        context_line = ''

    try:
        post_context = map(trim_line, source[(lineno + 1):upper_bound])
    except IndexError:
        post_context = []

    return pre_context, context_line, post_context


def discover_sourcemap(result):
    """
    Given a UrlResult object, attempt to discover a sourcemap.
    """
    # When coercing the headers returned by urllib to a dict
    # all keys become lowercase so they're normalized
    sourcemap = result.headers.get('sourcemap', result.headers.get('x-sourcemap'))

    if not sourcemap:
        parsed_body = result.body.splitlines()
        # Source maps are only going to exist at either the top or bottom of the document.
        # Technically, there isn't anything indicating *where* it should exist, so we
        # are generous and assume it's somewhere either in the first or last 5 lines.
        # If it's somewhere else in the document, you're probably doing it wrong.
        if len(parsed_body) > 10:
            possibilities = set(parsed_body[:5] + parsed_body[-5:])
        else:
            possibilities = set(parsed_body)

        for line in possibilities:
            if line.startswith('//@ sourceMappingURL=') or line.startswith('//# sourceMappingURL='):
                # We want everything AFTER the indicator, which is 21 chars long
                sourcemap = line[21:].rstrip()
                break

    if sourcemap:
        # fix url so its absolute
        sourcemap = urljoin(result.url, sourcemap)

    return sourcemap


def fetch_release_file(filename, release):
    cache_key = 'release:%s:%s' % (
        release.id,
        hashlib.sha1(filename.encode('utf-8')).hexdigest(),
    )
    logger.debug('Checking cache for release artfiact %r (release_id=%s)',
                 filename, release.id)
    result = cache.get(cache_key)
    if result is None:
        logger.debug('Checking database for release artifact %r (release_id=%s)',
                     filename, release.id)
        ident = ReleaseFile.get_ident(filename)
        try:
            releasefile = ReleaseFile.objects.filter(
                release=release,
                ident=ident,
            ).select_related('file').get()
        except ReleaseFile.DoesNotExist:
            logger.debug('Release artifact %r not found in database (release_id=%s)',
                         filename, release.id)
            return None

        logger.debug('Found release artifact %r (id=%s, release_id=%s)',
                     filename, releasefile.id, release.id)
        with releasefile.file.getfile() as fp:
            body = fp.read()
        result = (releasefile.file.headers, body, 200)
        cache.set(cache_key, result, 60)

    return result


def fetch_url(url, project=None, release=None):
    """
    Pull down a URL, returning a UrlResult object.

    Attempts to fetch from the cache.
    """
    cache_key = 'source:cache:v2:%s' % (
        hashlib.md5(url.encode('utf-8')).hexdigest(),)

    if release:
        result = fetch_release_file(url, release)
    else:
        result = None

    if result is None:
        logger.debug('Checking cache for url %r', url)
        result = cache.get(cache_key)

    if result is None:
        # lock down domains that are problematic
        domain = urlparse(url).netloc
        domain_key = 'source:blacklist:%s' % (
            hashlib.md5(domain.encode('utf-8')).hexdigest(),
        )
        domain_result = cache.get(domain_key)
        if domain_result:
            raise DomainBlacklisted(ERR_DOMAIN_BLACKLISTED.format(
                reason=domain_result,
            ))

        headers = {}
        if project and is_valid_origin(url, project=project):
            token = project.get_option('sentry:token')
            if token:
                headers['X-Sentry-Token'] = token

        logger.debug('Fetching %r from the internet', url)

        http_session = http.build_session()
        try:
            response = http_session.get(
                url,
                allow_redirects=True,
                verify=False,
                headers=headers,
                timeout=settings.SENTRY_SOURCE_FETCH_TIMEOUT,
            )
        except Exception as exc:
            logger.debug('Unable to fetch %r', url, exc_info=True)
            if isinstance(exc, SuspiciousOperation):
                error = unicode(exc)
            elif isinstance(exc, (RequestException, ZeroReturnError)):
                error = ERR_GENERIC_FETCH_FAILURE.format(
                    type=type(exc),
                )
            else:
                logger.exception(unicode(exc))
                error = ERR_UNKNOWN_INTERNAL_ERROR

            # TODO(dcramer): we want to be less aggressive on disabling domains
            cache.set(domain_key, error or '', 300)
            logger.warning('Disabling sources to %s for %ss', domain, 300,
                           exc_info=True)
            raise CannotFetchSource(error)

        # requests' attempts to use chardet internally when no encoding is found
        # and we want to avoid that slow behavior
        if not response.encoding:
            response.encoding = 'utf-8'

        result = (
            {k.lower(): v for k, v in response.headers.items()},
            response.text,
            response.status_code,
        )
        cache.set(cache_key, result, 60)

    if result[2] != 200:
        logger.debug('HTTP %s when fetching %r', result[2], url,
                     exc_info=True)
        error = ERR_HTTP_CODE.format(
            status_code=result[2],
        )
        raise CannotFetchSource(error)

    return UrlResult(url, result[0], result[1])


def fetch_sourcemap(url, project=None, release=None):
    if is_data_uri(url):
        body = base64.b64decode(url[BASE64_PREAMBLE_LENGTH:])
    else:
        result = fetch_url(url, project=project, release=release)
        body = result.body

    # According to various specs[1][2] a SourceMap may be prefixed to force
    # a Javascript load error.
    # [1] https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.h7yy76c5il9v
    # [2] http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-xssi
    if body.startswith((")]}'\n", ")]}\n")):
        body = body.split('\n', 1)[1]

    try:
        return sourcemap_to_index(body)
    except (JSONDecodeError, ValueError):
        raise UnparseableSourcemap(ERR_SOURCEMAP_UNPARSEABLE)


def is_data_uri(url):
    return url[:BASE64_PREAMBLE_LENGTH] == BASE64_SOURCEMAP_PREAMBLE


def generate_module(src):
    """
    Converts a url into a made-up module name by doing the following:
     * Extract just the path name ignoring querystrings
     * Trimming off the initial /
     * Trimming off the file extension
     * Removes off useless folder prefixes

    e.g. http://google.com/js/v1.0/foo/bar/baz.js -> foo/bar/baz
    """
    if not src:
        return UNKNOWN_MODULE

    filename, ext = splitext(urlsplit(src).path)
    if ext not in ('.js', '.coffee'):
        return UNKNOWN_MODULE

    if filename.endswith('.min'):
        filename = filename[:-4]
    return CLEAN_MODULE_RE.sub('', filename) or UNKNOWN_MODULE


def generate_culprit(frame):
    return '%s in %s' % (frame.module, frame.function)


class SourceProcessor(object):
    """
    Attempts to fetch source code for javascript frames.

    Frames must match the following requirements:

    - lineno >= 0
    - colno >= 0
    - abs_path is the HTTP URI to the source
    - context_line is empty

    Mutates the input ``data`` with expanded context if available.
    """
    def __init__(self, max_fetches=MAX_RESOURCE_FETCHES):
        self.max_fetches = max_fetches
        self.cache = SourceCache()
        self.sourcemaps = SourceMapCache()

    def get_stacktraces(self, data):
        try:
            stacktraces = [
                Stacktrace.to_python(e['stacktrace'])
                for e in data['sentry.interfaces.Exception']['values']
                if e.get('stacktrace')
            ]
        except KeyError:
            stacktraces = None

        return stacktraces

    def get_valid_frames(self, stacktraces):
        # build list of frames that we can actually grab source for
        frames = []
        for stacktrace in stacktraces:
            frames.extend([
                f for f in stacktrace.frames
                if f.lineno is not None
                and f.is_url()
            ])
        return frames

    def get_release(self, data):
        if not data.get('release'):
            return

        try:
            return Release.objects.get(
                project=data['project'],
                version=data['release'],
            )
        except Release.DoesNotExist:
            return

    def process(self, data):
        stacktraces = self.get_stacktraces(data)
        if not stacktraces:
            logger.debug('No stacktrace for event %r', data['event_id'])
            return

        frames = self.get_valid_frames(stacktraces)
        if not frames:
            logger.debug('Event %r has no frames with enough context to fetch remote source', data['event_id'])
            return

        project = Project.objects.get_from_cache(
            id=data['project'],
        )

        release = self.get_release(data)

        # all of these methods assume mutation on the original
        # objects rather than re-creation
        self.populate_source_cache(project, frames, release)
        self.expand_frames(frames)
        self.ensure_module_names(frames)
        self.fix_culprit(data, stacktraces)
        self.update_stacktraces(data, stacktraces)

        return data

    def fix_culprit(self, data, stacktraces):
        culprit_frame = stacktraces[0].frames[-1]
        if culprit_frame.module and culprit_frame.function:
            data['culprit'] = truncatechars(generate_culprit(culprit_frame), MAX_CULPRIT_LENGTH)

    def update_stacktraces(self, data, stacktraces):
        for exception, stacktrace in zip(data['sentry.interfaces.Exception']['values'], stacktraces):
            exception['stacktrace'] = stacktrace.to_json()

    def ensure_module_names(self, frames):
        # TODO(dcramer): this doesn't really fit well with generic URLs so we
        # whitelist it to http/https
        for frame in frames:
            if not frame.module and frame.abs_path.startswith(('http:', 'https:')):
                frame.module = generate_module(frame.abs_path)

    def expand_frames(self, frames):
        last_state = None
        state = None
        has_changes = False

        cache = self.cache
        sourcemaps = self.sourcemaps

        for frame in frames:
            errors = cache.get_errors(frame.abs_path)
            if errors:
                has_changes = True

            frame.errors = errors

            source = cache.get(frame.abs_path)
            if source is None:
                logger.info('No source found for %s', frame.abs_path)
                continue

            sourcemap_url, sourcemap_idx = sourcemaps.get_link(frame.abs_path)
            if sourcemap_idx and frame.colno is not None:
                last_state = state
                state = find_source(sourcemap_idx, frame.lineno, frame.colno)
                abs_path = urljoin(sourcemap_url, state.src)

                logger.debug('Mapping compressed source %r to mapping in %r', frame.abs_path, abs_path)
                source = cache.get(abs_path)
                if not source:
                    frame.data = {
                        'sourcemap': sourcemap_url,
                    }
                    errors = cache.get_errors(abs_path)
                    if errors:
                        frame.errors.extend(errors)
                    else:
                        frame.errors.append(ERR_MISSING_SOURCE.format(
                            filename=abs_path.encode('utf-8'),
                        ))

                # Store original data in annotation
                frame.data = {
                    'orig_lineno': frame.lineno,
                    'orig_colno': frame.colno,
                    'orig_function': frame.function,
                    'orig_abs_path': frame.abs_path,
                    'orig_filename': frame.filename,
                    'sourcemap': sourcemap_url,
                }

                # SourceMap's return zero-indexed lineno's
                frame.lineno = state.src_line + 1
                frame.colno = state.src_col
                # The offending function is always the previous function in the stack
                # Honestly, no idea what the bottom most frame is, so we're ignoring that atm
                if last_state:
                    frame.function = last_state.name or frame.function
                else:
                    frame.function = state.name or frame.function
                frame.abs_path = abs_path
                frame.filename = state.src
                frame.module = generate_module(state.src)

            elif sourcemap_url:
                frame.data = {
                    'sourcemap': sourcemap_url,
                }

            # TODO: theoretically a minified source could point to another mapped, minified source
            frame.pre_context, frame.context_line, frame.post_context = get_source_context(
                source=source, lineno=frame.lineno, colno=frame.colno or 0)

    def populate_source_cache(self, project, frames, release):
        pending_file_list = set()
        done_file_list = set()
        sourcemap_capable = set()

        cache = self.cache
        sourcemaps = self.sourcemaps

        for f in frames:
            pending_file_list.add(f.abs_path)
            if f.colno is not None:
                sourcemap_capable.add(f.abs_path)

        idx = 0
        while pending_file_list:
            idx += 1
            filename = pending_file_list.pop()
            done_file_list.add(filename)

            if idx > self.max_fetches:
                cache.add_error(filename, ERR_TOO_MANY_REMOTE_SOURCES)
                continue

            # TODO: respect cache-control/max-age headers to some extent
            logger.debug('Fetching remote source %r', filename)
            try:
                result = fetch_url(filename, project=project, release=release)
            except BadSource as exc:
                cache.add_error(filename, unicode(exc))
                continue

            cache.add(filename, result.body.splitlines())
            cache.alias(result.url, filename)

            sourcemap_url = discover_sourcemap(result)
            if not sourcemap_url:
                continue

            # If we didn't have a colno, a sourcemap wont do us any good
            if filename not in sourcemap_capable:
                cache.add_error(filename, ERR_NO_COLUMN)
                continue

            logger.debug('Found sourcemap %r for minified script %r', sourcemap_url[:256], result.url)

            sourcemaps.link(filename, sourcemap_url)
            if sourcemap_url in sourcemaps:
                continue

            # pull down sourcemap
            try:
                sourcemap_idx = fetch_sourcemap(
                    sourcemap_url,
                    project=project,
                    release=release,
                )
            except BadSource as exc:
                cache.add_error(filename, unicode(exc))
                continue

            sourcemaps.add(sourcemap_url, sourcemap_idx)

            # queue up additional source files for download
            for source in sourcemap_idx.sources:
                next_filename = urljoin(sourcemap_url, source)
                if next_filename not in done_file_list:
                    if sourcemap_idx.content:
                        cache.add(next_filename, sourcemap_idx.content[source])
                        done_file_list.add(next_filename)
                    else:
                        pending_file_list.add(next_filename)
