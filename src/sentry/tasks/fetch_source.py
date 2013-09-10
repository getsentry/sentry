"""
sentry.tasks.fetch_source
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import itertools
import logging
import hashlib
import re
import urllib2
import zlib
from collections import namedtuple
from urlparse import urljoin

from django.utils.simplejson import JSONDecodeError

from sentry.constants import SOURCE_FETCH_TIMEOUT
from sentry.utils.cache import cache
from sentry.utils.sourcemaps import sourcemap_to_index, find_source


BAD_SOURCE = -1
# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5
CHARSET_RE = re.compile(r'charset=(\S+)')
DEFAULT_ENCODING = 'utf-8'

UrlResult = namedtuple('UrlResult', ['url', 'headers', 'body'])

logger = logging.getLogger(__name__)


def trim_line(line):
    line = line.strip('\n')
    if len(line) > 150:
        line = line[:140] + ' [... truncated]'
    return line


def get_source_context(source, lineno, context=LINES_OF_CONTEXT):
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
        context_line = trim_line(source[lineno])
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


def fetch_url_content(url):
    """
    Pull down a URL, returning a tuple (url, headers, body).
    """
    import sentry

    try:
        opener = urllib2.build_opener()
        opener.addheaders = [
            ('Accept-Encoding', 'gzip'),
            ('User-Agent', 'Sentry/%s' % sentry.VERSION),
        ]
        req = opener.open(url, timeout=SOURCE_FETCH_TIMEOUT)
        headers = dict(req.headers)
        body = req.read()
        if headers.get('content-encoding') == 'gzip':
            # Content doesn't *have* to respect the Accept-Encoding header
            # and may send gzipped data regardless.
            # See: http://stackoverflow.com/questions/2423866/python-decompressing-gzip-chunk-by-chunk/2424549#2424549
            body = zlib.decompress(body, 16 + zlib.MAX_WBITS)

        try:
            content_type = headers['content-type']
        except KeyError:
            # If there is no content_type header at all, quickly assume default utf-8 encoding
            encoding = DEFAULT_ENCODING
        else:
            try:
                encoding = CHARSET_RE.search(content_type).group(1)
            except AttributeError:
                encoding = DEFAULT_ENCODING

        body = body.decode(encoding).rstrip('\n')
    except Exception:
        logging.info('Failed fetching %r', url, exc_info=True)
        return BAD_SOURCE

    return (url, headers, body)


def fetch_url(url):
    """
    Pull down a URL, returning a UrlResult object.

    Attempts to fetch from the cache.
    """

    cache_key = 'fetch_url:v2:%s' % (
        hashlib.md5(url.encode('utf-8')).hexdigest(),)
    result = cache.get(cache_key)
    if result is None:
        result = fetch_url_content(url)

        cache.set(cache_key, result, 30)

    if result == BAD_SOURCE:
        return result

    return UrlResult(*result)


def fetch_sourcemap(url):
    result = fetch_url(url)
    if result == BAD_SOURCE:
        return

    body = result.body
    # According to spec (https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.h7yy76c5il9v)
    # A SourceMap may be prepended with ")]}'" to cause a Javascript error.
    # If the file starts with that string, ignore the entire first line.
    if body.startswith(")]}'"):
        body = body.split('\n', 1)[1]
    try:
        index = sourcemap_to_index(body)
    except (JSONDecodeError, ValueError):
        return
    else:
        return index


def expand_javascript_source(data, **kwargs):
    """
    Attempt to fetch source code for javascript frames.

    Frames must match the following requirements:

    - lineno >= 0
    - colno >= 0
    - abs_path is the HTTP URI to the source
    - context_line is empty

    Mutates the input ``data`` with expanded context if available.
    """
    from sentry.interfaces import Stacktrace

    try:
        stacktraces = [
            Stacktrace(**e['stacktrace'])
            for e in data['sentry.interfaces.Exception']['values']
            if e.get('stacktrace')
        ]
    except KeyError:
        stacktraces = []

    if not stacktraces:
        logger.debug('No stacktrace for event %r', data['event_id'])
        return

    # build list of frames that we can actually grab source for
    frames = []
    for stacktrace in stacktraces:
        frames.extend([
            f for f in stacktrace.frames
            if f.lineno is not None
            and f.is_url()
        ])

    if not frames:
        logger.debug('Event %r has no frames with enough context to fetch remote source', data['event_id'])
        return data

    pending_file_list = set()
    done_file_list = set()
    sourcemap_capable = set()
    source_code = {}
    sourmap_idxs = {}

    for f in frames:
        pending_file_list.add(f.abs_path)
        if f.colno is not None:
            sourcemap_capable.add(f.abs_path)

    while pending_file_list:
        filename = pending_file_list.pop()
        done_file_list.add(filename)

        # TODO: respect cache-contro/max-age headers to some extent
        logger.debug('Fetching remote source %r', filename)
        result = fetch_url(filename)

        if result == BAD_SOURCE:
            logger.debug('Bad source file %r', filename)
            continue

        # If we didn't have a colno, a sourcemap wont do us any good
        if filename not in sourcemap_capable:
            logger.debug('Not capable of sourcemap: %r', filename)
            source_code[filename] = (result.body.splitlines(), None)
            continue

        sourcemap = discover_sourcemap(result)
        source_code[filename] = (result.body.splitlines(), sourcemap)

        # TODO: we're currently running splitlines twice
        if sourcemap:
            logger.debug('Found sourcemap %r for minified script %r', sourcemap, result.url)
        elif sourcemap in sourmap_idxs or not sourcemap:
            continue

        # pull down sourcemap
        index = fetch_sourcemap(sourcemap)
        if not index:
            logger.debug('Failed parsing sourcemap index: %r', sourcemap[:15])
            continue

        sourmap_idxs[sourcemap] = index

        # queue up additional source files for download
        for source in index.sources:
            next_filename = urljoin(result.url, source)
            if next_filename not in done_file_list:
                pending_file_list.add(next_filename)

    has_changes = False
    for frame in frames:
        try:
            source, sourcemap = source_code[frame.abs_path]
        except KeyError:
            # we must've failed pulling down the source
            continue

        # may have had a failure pulling down the sourcemap previously
        if sourcemap in sourmap_idxs and frame.colno is not None:
            state = find_source(sourmap_idxs[sourcemap], frame.lineno, frame.colno)
            # TODO: is this urljoin right? (is it relative to the sourcemap or the originating file)
            abs_path = urljoin(sourcemap, state.src)
            logger.debug('Mapping compressed source %r to mapping in %r', frame.abs_path, abs_path)
            try:
                source, _ = source_code[abs_path]
            except KeyError:
                frame.data = {
                    'sourcemap': sourcemap,
                }
                logger.debug('Failed mapping path %r', abs_path)
            else:
                # Store original data in annotation
                frame.data = {
                    'orig_lineno': frame['lineno'],
                    'orig_colno': frame['colno'],
                    'orig_function': frame['function'],
                    'orig_abs_path': frame['abs_path'],
                    'orig_filename': frame['filename'],
                    'sourcemap': sourcemap,
                }

                # SourceMap's return zero-indexed lineno's
                frame.lineno = state.src_line + 1
                frame.colno = state.src_col
                frame.function = state.name
                frame.abs_path = abs_path
                frame.filename = state.src

        has_changes = True

        # TODO: theoretically a minified source could point to another mapped, minified source
        frame.pre_context, frame.context_line, frame.post_context = get_source_context(
            source=source, lineno=frame.lineno)

    if has_changes:
        logger.debug('Updating stacktraces with expanded source context')
        for exception, stacktrace in itertools.izip(data['sentry.interfaces.Exception']['values'], stacktraces):
            exception['stacktrace'] = stacktrace.serialize()
