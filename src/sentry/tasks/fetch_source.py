"""
sentry.tasks.fetch_source
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import itertools
import logging
import hashlib
import sourcemap
import urllib2
import zlib
from collections import namedtuple
from urlparse import urljoin

from django.utils.simplejson import JSONDecodeError
from sentry.utils.cache import cache

BAD_SOURCE = -1

# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5

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
    map_path = result.headers.get('sourcemap', result.headers.get('x-sourcemap'))
    if not map_path:
        map_path = sourcemap.discover(result.body)

    if map_path:
        # ensure url is absolute
        map_path = urljoin(result.url, map_path)

    return map_path


def fetch_url_content(url):
    """
    Pull down a URL, returning a tuple (url, headers, body).
    """
    import sentry

    try:
        opener = urllib2.build_opener()
        opener.addheaders = [('User-Agent', 'Sentry/%s' % sentry.VERSION)]
        req = opener.open(url)
        headers = dict(req.headers)
        body = req.read()
        if headers.get('content-encoding') == 'gzip':
            # Content doesn't *have* to respect the Accept-Encoding header
            # and may send gzipped data regardless.
            # See: http://stackoverflow.com/questions/2423866/python-decompressing-gzip-chunk-by-chunk/2424549#2424549
            body = zlib.decompress(body, 16 + zlib.MAX_WBITS)
        body = body.rstrip('\n')
    except Exception:
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

        cache.set(cache_key, result, 60 * 5)

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
        index = sourcemap.loads(body)
    except (JSONDecodeError, ValueError):
        pass
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

    # TODO: clean this up
    legacy_style = ('sentry.interfaces.Stacktrace' in data)

    if legacy_style:
        stacktraces = [Stacktrace(**data['sentry.interfaces.Stacktrace'])]
    else:
        try:
            stacktraces = [
                Stacktrace(**e['stacktrace'])
                for e in data['sentry.interfaces.Exception']['values']
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

    file_list = set()
    sourcemap_capable = set()
    source_code = {}
    sourcemap_idxs = {}

    for f in frames:
        file_list.add(f.abs_path)
        if f.colno is not None:
            sourcemap_capable.add(f.abs_path)

    while file_list:
        filename = file_list.pop()

        # TODO: respect cache-contro/max-age headers to some extent
        logger.debug('Fetching remote source %r', filename)
        result = fetch_url(filename)

        if result == BAD_SOURCE:
            logger.debug('Unable to fetch remote source for %r', filename)
            continue

        # If we didn't have a colno, a sourcemap wont do us any good
        if filename not in sourcemap_capable:
            source_code[filename] = (result.body.splitlines(), None)
            continue

        map_path = discover_sourcemap(result)
        source_code[filename] = (result.body.splitlines(), map_path)
        if map_path:
            logger.debug('Found sourcemap %r for minified script %r', map_path, result.url)
        # If we've already fetched this sourcemap, move along
        elif map_path in sourcemap_idxs:
            continue
        else:
            logger.debug('No sourcemap found for %r', filename)
            continue

        index = fetch_sourcemap(map_path)
        if not index:
            sourcemap_idxs[sourcemap] = None
            continue

        sourcemap_idxs[sourcemap] = index

        # queue up additional source files for download
        for source in index.sources:
            if source not in source_code:
                file_list.add(urljoin(result.url, source))

    has_changes = False
    for frame in frames:
        try:
            source, map_path = source_code[frame.abs_path]
        except KeyError:
            # we must've failed pulling down the source
            continue

        # may have had a failure pulling down the sourcemap previously
        if sourcemap_idxs.get(map_path) and frame.colno is not None:
            token = sourcemap_idxs[map_path].lookup(frame.lineno, frame.colno)
            # TODO: is this urljoin right? (is it relative to the sourcemap or the originating file)
            abs_path = urljoin(map_path, token.src)
            logger.debug('Mapping compressed source %r to mapping in %r', frame.abs_path, abs_path)
            try:
                source, _ = source_code[abs_path]
            except KeyError:
                pass
            else:
                # Store original data in annotation
                frame.data = {
                    'orig_lineno': frame['lineno'],
                    'orig_colno': frame['colno'],
                    'orig_function': frame['function'],
                    'orig_abs_path': frame['abs_path'],
                    'orig_filename': frame['filename'],
                    'sourcemap': map_path,
                }

                # SourceMap's return zero-indexed lineno's
                frame.lineno = token.src_line + 1
                frame.colno = token.src_col
                frame.function = token.name
                frame.abs_path = abs_path
                frame.filename = token.src

        has_changes = True

        # TODO: theoretically a minified source could point to another mapped, minified source
        frame.pre_context, frame.context_line, frame.post_context = get_source_context(
            source=source, lineno=frame.lineno)

    if has_changes:
        if legacy_style:
            data['sentry.interfaces.Stacktrace'] = stacktraces[0].serialize()
        else:
            for exception, stacktrace in itertools.izip(data['sentry.interfaces.Exception']['values'], stacktraces):
                exception['stacktrace'] = stacktrace.serialize()
