from __future__ import absolute_import, print_function

__all__ = ['JavaScriptStacktraceProcessor']

import logging
import re
import base64
import six
import zlib

from django.conf import settings
from os.path import splitext
from requests.utils import get_encoding_from_headers
from six.moves.urllib.parse import urlparse, urljoin, urlsplit
from libsourcemap import from_json as view_from_json

# In case SSL is unavailable (light builds) we can't import this here.
try:
    from OpenSSL.SSL import ZeroReturnError
except ImportError:
    class ZeroReturnError(Exception):
        pass

from sentry import http
from sentry.interfaces.stacktrace import Stacktrace
from sentry.models import EventError, Release, ReleaseFile
from sentry.utils.cache import cache
from sentry.utils.files import compress_file
from sentry.utils.hashlib import md5_text
from sentry.utils.http import is_valid_origin
from sentry.utils import metrics
from sentry.stacktraces import StacktraceProcessor

from .cache import SourceCache, SourceMapCache


# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5
BASE64_SOURCEMAP_PREAMBLE = 'data:application/json;base64,'
BASE64_PREAMBLE_LENGTH = len(BASE64_SOURCEMAP_PREAMBLE)
UNKNOWN_MODULE = '<unknown module>'
CLEAN_MODULE_RE = re.compile(r"""^
(?:/|  # Leading slashes
(?:
    (?:java)?scripts?|js|build|static|node_modules|bower_components|[_\.~].*?|  # common folder prefixes
    v?(?:\d+\.)*\d+|   # version numbers, v1, 1.0.0
    [a-f0-9]{7,8}|     # short sha
    [a-f0-9]{32}|      # md5
    [a-f0-9]{40}       # sha1
)/)+|
(?:[-\.][a-f0-9]{7,}$)  # Ending in a commitish
""", re.X | re.I)
VERSION_RE = re.compile(r'^[a-f0-9]{32}|[a-f0-9]{40}$', re.I)
NODE_MODULES_RE = re.compile(r'\bnode_modules/')
SOURCE_MAPPING_URL_RE = re.compile(r'\/\/# sourceMappingURL=(.*)$')
# the maximum number of remote resources (i.e. sourc eifles) that should be
# fetched
MAX_RESOURCE_FETCHES = 100

logger = logging.getLogger(__name__)


class UnparseableSourcemap(http.BadSource):
    error_type = EventError.JS_INVALID_SOURCEMAP


def trim_line(line, column=0):
    """
    Trims a line down to a goal of 140 characters, with a little
    wiggle room to be sensible and tries to trim around the given
    `column`. So it tries to extract 60 characters before and after
    the provided `column` and yield a better context.
    """
    line = line.strip(u'\n')
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
        line += u' {snip}'
    if start > 0:
        # we've snipped from the beginning
        line = u'{snip} ' + line
    return line


def get_source_context(source, lineno, colno, context=LINES_OF_CONTEXT):
    if not source:
        return None, None, None

    # lineno's in JS are 1-indexed
    # just in case. sometimes math is hard
    if lineno > 0:
        lineno -= 1

    lower_bound = max(0, lineno - context)
    upper_bound = min(lineno + 1 + context, len(source))

    try:
        pre_context = [trim_line(x) for x in source[lower_bound:lineno]]
    except IndexError:
        pre_context = []

    try:
        context_line = trim_line(source[lineno], colno)
    except IndexError:
        context_line = ''

    try:
        post_context = [trim_line(x) for x in source[(lineno + 1):upper_bound]]
    except IndexError:
        post_context = []

    return pre_context or None, context_line, post_context or None


def discover_sourcemap(result):
    """
    Given a UrlResult object, attempt to discover a sourcemap.
    """
    # When coercing the headers returned by urllib to a dict
    # all keys become lowercase so they're normalized
    sourcemap = result.headers.get('sourcemap', result.headers.get('x-sourcemap'))

    if not sourcemap:
        parsed_body = result.body.split('\n')
        # Source maps are only going to exist at either the top or bottom of the document.
        # Technically, there isn't anything indicating *where* it should exist, so we
        # are generous and assume it's somewhere either in the first or last 5 lines.
        # If it's somewhere else in the document, you're probably doing it wrong.
        if len(parsed_body) > 10:
            possibilities = parsed_body[:5] + parsed_body[-5:]
        else:
            possibilities = parsed_body

        # We want to scan each line sequentially, and the last one found wins
        # This behavior is undocumented, but matches what Chrome and Firefox do.
        for line in possibilities:
            if line[:21] in ('//# sourceMappingURL=', '//@ sourceMappingURL='):
                # We want everything AFTER the indicator, which is 21 chars long
                sourcemap = line[21:].rstrip()

        # If we still haven't found anything, check end of last line AFTER source code.
        # This is not the literal interpretation of the spec, but browsers support it.
        # e.g. {code}//# sourceMappingURL={url}
        if not sourcemap:
            # Only look at last 300 characters to keep search space reasonable (minified
            # JS on a single line could be tens of thousands of chars). This is a totally
            # arbitrary number / best guess; most sourceMappingURLs are relative and
            # not very long.
            search_space = possibilities[-1][-300:].rstrip()
            match = SOURCE_MAPPING_URL_RE.search(search_space)
            if match:
                sourcemap = match.group(1)

    if sourcemap:
        # react-native shoves a comment at the end of the
        # sourceMappingURL line.
        # For example:
        #  sourceMappingURL=app.js.map/*ascii:...*/
        # This comment is completely out of spec and no browser
        # would support this, but we need to strip it to make
        # people happy.
        if '/*' in sourcemap and sourcemap[-2:] == '*/':
            index = sourcemap.index('/*')
            # comment definitely shouldn't be the first character,
            # so let's just make sure of that.
            if index == 0:
                raise AssertionError(
                    'react-native comment found at bad location: %d, %r' %
                    (index, sourcemap)
                )
            sourcemap = sourcemap[:index]
        # fix url so its absolute
        sourcemap = urljoin(result.url, sourcemap)

    return sourcemap


def fetch_release_file(filename, release):
    cache_key = 'releasefile:v1:%s:%s' % (
        release.id,
        md5_text(filename).hexdigest(),
    )

    filename_path = None
    if filename is not None:
        # Reconstruct url without protocol + host
        # e.g. http://example.com/foo?bar => ~/foo?bar
        parsed_url = urlparse(filename)
        filename_path = '~' + parsed_url.path
        if parsed_url.query:
            filename_path += '?' + parsed_url.query

    logger.debug('Checking cache for release artifact %r (release_id=%s)',
                 filename, release.id)
    result = cache.get(cache_key)

    if result is None:
        logger.debug('Checking database for release artifact %r (release_id=%s)',
                     filename, release.id)

        filename_idents = [ReleaseFile.get_ident(filename)]
        if filename_path is not None and filename_path != filename:
            filename_idents.append(ReleaseFile.get_ident(filename_path))

        possible_files = list(ReleaseFile.objects.filter(
            release=release,
            ident__in=filename_idents,
        ).select_related('file'))

        if len(possible_files) == 0:
            logger.debug('Release artifact %r not found in database (release_id=%s)',
                         filename, release.id)
            cache.set(cache_key, -1, 60)
            return None
        elif len(possible_files) == 1:
            releasefile = possible_files[0]
        else:
            # Prioritize releasefile that matches full url (w/ host)
            # over hostless releasefile
            target_ident = filename_idents[0]
            releasefile = next((f for f in possible_files if f.ident == target_ident))

        logger.debug('Found release artifact %r (id=%s, release_id=%s)',
                     filename, releasefile.id, release.id)
        try:
            with metrics.timer('sourcemaps.release_file_read'):
                with releasefile.file.getfile() as fp:
                    z_body, body = compress_file(fp)
        except Exception as e:
            logger.exception(six.text_type(e))
            cache.set(cache_key, -1, 3600)
            result = None
        else:
            headers = {k.lower(): v for k, v in releasefile.file.headers.items()}
            encoding = get_encoding_from_headers(headers)
            result = http.UrlResult(filename, headers, body, 200, encoding)
            cache.set(cache_key, (headers, z_body, 200, encoding), 3600)

    elif result == -1:
        # We cached an error, so normalize
        # it down to None
        result = None
    else:
        # Previous caches would be a 3-tuple instead of a 4-tuple,
        # so this is being maintained for backwards compatibility
        try:
            encoding = result[3]
        except IndexError:
            encoding = None
        result = http.UrlResult(filename, result[0], zlib.decompress(result[1]), result[2], encoding)

    return result


def fetch_file(url, project=None, release=None, allow_scraping=True):
    """
    Pull down a URL, returning a UrlResult object.

    Attempts to fetch from the cache.
    """
    # If our url has been truncated, it'd be impossible to fetch
    # so we check for this early and bail
    if url[-3:] == '...':
        raise http.CannotFetch({
            'type': EventError.JS_MISSING_SOURCE,
            'url': http.expose_url(url),
        })
    if release:
        with metrics.timer('sourcemaps.release_file'):
            result = fetch_release_file(url, release)
    else:
        result = None

    cache_key = 'source:cache:v4:%s' % (
        md5_text(url).hexdigest(),
    )

    if result is None:
        if not allow_scraping or not url.startswith(('http:', 'https:')):
            error = {
                'type': EventError.JS_MISSING_SOURCE,
                'url': http.expose_url(url),
            }
            raise http.CannotFetch(error)

        logger.debug('Checking cache for url %r', url)
        result = cache.get(cache_key)
        if result is not None:
            # Previous caches would be a 3-tuple instead of a 4-tuple,
            # so this is being maintained for backwards compatibility
            try:
                encoding = result[4]
            except IndexError:
                encoding = None
            # We got a cache hit, but the body is compressed, so we
            # need to decompress it before handing it off
            result = http.UrlResult(result[0], result[1], zlib.decompress(result[2]), result[3], encoding)

    if result is None:
        headers = {}
        verify_ssl = False
        if project and is_valid_origin(url, project=project):
            verify_ssl = bool(project.get_option('sentry:verify_ssl', False))
            token = project.get_option('sentry:token')
            if token:
                token_header = project.get_option(
                    'sentry:token_header',
                    'X-Sentry-Token',
                )
                headers[token_header] = token

        with metrics.timer('sourcemaps.fetch'):
            result = http.fetch_file(url, headers=headers, verify_ssl=verify_ssl)
            z_body = zlib.compress(result.body)
            cache.set(cache_key, (url, result.headers, z_body, result.status, result.encoding), 60)

    # Make sure the file we're getting back is six.binary_type. The only
    # reason it'd not be binary would be from old cached blobs, so
    # for compatibility with current cached files, let's coerce back to
    # binary and say utf8 encoding.
    if not isinstance(result.body, six.binary_type):
        try:
            result = http.UrlResult(result.url, result.headers, result.body.encode('utf8'), result.status, result.encoding)
        except UnicodeEncodeError:
            error = {
                'type': EventError.FETCH_INVALID_ENCODING,
                'value': 'utf8',
                'url': http.expose_url(url),
            }
            raise http.CannotFetch(error)

    # For JavaScript files, check if content is something other than JavaScript/JSON (i.e. HTML)
    # NOTE: possible to have JS files that don't actually end w/ ".js", but this should catch 99% of cases
    if url.endswith('.js'):
        # Check if response is HTML by looking if the first non-whitespace character is an open tag ('<').
        # This cannot parse as valid JS/JSON.
        # NOTE: not relying on Content-Type header because apps often don't set this correctly
        body_start = result.body[:20].lstrip()  # Discard leading whitespace (often found before doctype)

        if body_start[:1] == u'<':
            error = {
                'type': EventError.JS_INVALID_CONTENT,
                'url': url,
            }
            raise http.CannotFetch(error)

    return result


def fetch_sourcemap(url, project=None, release=None, allow_scraping=True):
    if is_data_uri(url):
        try:
            body = base64.b64decode(
                url[BASE64_PREAMBLE_LENGTH:] + (b'=' * (-(len(url) - BASE64_PREAMBLE_LENGTH) % 4))
            )
        except TypeError as e:
            raise UnparseableSourcemap({
                'url': '<base64>',
                'reason': e.message,
            })
    else:
        result = fetch_file(url, project=project, release=release,
                            allow_scraping=allow_scraping)
        body = result.body
    try:
        return view_from_json(body)
    except Exception as exc:
        # This is in debug because the product shows an error already.
        logger.debug(six.text_type(exc), exc_info=True)
        raise UnparseableSourcemap({
            'url': http.expose_url(url),
        })


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
    if ext not in ('.js', '.jsx', '.coffee'):
        return UNKNOWN_MODULE

    if filename.endswith('.min'):
        filename = filename[:-4]

    # TODO(dcramer): replace CLEAN_MODULE_RE with tokenizer completely
    tokens = filename.split('/')
    for idx, token in enumerate(tokens):
        # a SHA
        if VERSION_RE.match(token):
            return '/'.join(tokens[idx + 1:])

    return CLEAN_MODULE_RE.sub('', filename) or UNKNOWN_MODULE


class JavaScriptStacktraceProcessor(StacktraceProcessor):
    """
    Attempts to fetch source code for javascript frames.

    Frames must match the following requirements:

    - lineno >= 0
    - colno >= 0
    - abs_path is the HTTP URI to the source
    - context_line is empty

    Mutates the input ``data`` with expanded context if available.
    """

    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)
        self.max_fetches = MAX_RESOURCE_FETCHES
        self.allow_scraping = self.project.get_option(
            'sentry:scrape_javascript', True)
        self.fetch_count = 0
        self.cache = SourceCache()
        self.sourcemaps = SourceMapCache()
        self.release = None

    def get_stacktraces(self, data):
        try:
            stacktraces = [
                e['stacktrace']
                for e in data['sentry.interfaces.Exception']['values']
                if e.get('stacktrace')
            ]
        except KeyError:
            stacktraces = []

        if 'sentry.interfaces.Stacktrace' in data:
            stacktraces.append(data['sentry.interfaces.Stacktrace'])

        return [
            (s, Stacktrace.to_python(s))
            for s in stacktraces
        ]

    def get_valid_frames(self):
        # build list of frames that we can actually grab source for
        frames = []
        for info in self.stacktrace_infos:
            frames.extend([
                f for f in info.stacktrace['frames']
                if f.get('lineno') is not None
            ])
        return frames

    def preprocess_step(self, processing_task):
        frames = self.get_valid_frames()
        if not frames:
            logger.debug('Event %r has no frames with enough context to '
                         'fetch remote source', self.data['event_id'])
            return False

        if self.data.get('release'):
            self.release = Release.get(
                project=self.project,
                version=self.data['release'],
            )
        self.populate_source_cache(frames)
        return True

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get('platform') or self.data.get('platform')
        return (
            settings.SENTRY_SCRAPE_JAVASCRIPT_CONTEXT and
            platform == 'javascript'
        )

    def process_frame(self, processable_frame, processing_task):
        frame = processable_frame.frame
        last_token = None
        token = None

        cache = self.cache
        sourcemaps = self.sourcemaps
        all_errors = []
        sourcemap_applied = False

        # can't fetch source if there's no filename present
        if not frame.get('abs_path'):
            return

        errors = cache.get_errors(frame['abs_path'])
        if errors:
            all_errors.extend(errors)

        # This might fail but that's okay, we try with a different path a
        # bit later down the road.
        source = self.get_source(frame['abs_path'])

        in_app = None
        new_frame = dict(frame)
        raw_frame = dict(frame)

        sourcemap_url, sourcemap_view = sourcemaps.get_link(frame['abs_path'])
        if sourcemap_view and frame.get('colno') is None:
            all_errors.append({
                'type': EventError.JS_NO_COLUMN,
                'url': http.expose_url(frame['abs_path']),
            })
        elif sourcemap_view:
            last_token = token

            if is_data_uri(sourcemap_url):
                sourcemap_label = frame['abs_path']
            else:
                sourcemap_label = sourcemap_url

            sourcemap_label = http.expose_url(sourcemap_label)

            try:
                # Errors are 1-indexed in the frames, so we need to -1 to get
                # zero-indexed value from tokens.
                assert frame['lineno'] > 0, "line numbers are 1-indexed"
                token = sourcemap_view.lookup_token(
                    frame['lineno'] - 1, frame['colno'])
            except Exception:
                token = None
                all_errors.append({
                    'type': EventError.JS_INVALID_SOURCEMAP_LOCATION,
                    'column': frame.get('colno'),
                    'row': frame.get('lineno'),
                    'source': frame['abs_path'],
                    'sourcemap': sourcemap_label,
                })

            # Store original data in annotation
            new_frame['data'] = dict(frame.get('data') or {},
                                     sourcemap=sourcemap_label)

            sourcemap_applied = True

            if token is not None:
                abs_path = urljoin(sourcemap_url, token.src)

                logger.debug('Mapping compressed source %r to mapping in %r',
                             frame['abs_path'], abs_path)
                source = self.get_source(abs_path)

            if not source:
                errors = cache.get_errors(abs_path)
                if errors:
                    all_errors.extend(errors)
                else:
                    all_errors.append({
                        'type': EventError.JS_MISSING_SOURCE,
                        'url': http.expose_url(abs_path),
                    })

            if token is not None:
                # Token's return zero-indexed lineno's
                new_frame['lineno'] = token.src_line + 1
                new_frame['colno'] = token.src_col
                # The offending function is always the previous function in the stack
                # Honestly, no idea what the bottom most frame is, so we're ignoring that atm
                if last_token:
                    new_frame['function'] = last_token.name or frame.get('function')
                else:
                    new_frame['function'] = token.name or frame.get('function')

                filename = token.src
                # special case webpack support
                # abs_path will always be the full path with webpack:/// prefix.
                # filename will be relative to that
                if abs_path.startswith('webpack:'):
                    filename = abs_path
                    # webpack seems to use ~ to imply "relative to resolver root"
                    # which is generally seen for third party deps
                    # (i.e. node_modules)
                    if '/~/' in filename:
                        filename = '~/' + abs_path.split('/~/', 1)[-1]
                    else:
                        filename = filename.split('webpack:///', 1)[-1]

                    # As noted above, '~/' means they're coming from node_modules,
                    # so these are not app dependencies
                    if filename.startswith('~/'):
                        in_app = False
                    # And conversely, local dependencies start with './'
                    elif filename.startswith('./'):
                        in_app = True

                    # We want to explicitly generate a webpack module name
                    new_frame['module'] = generate_module(filename)

                if abs_path.startswith('app:'):
                    if NODE_MODULES_RE.search(filename):
                        in_app = False
                    else:
                        in_app = True

                new_frame['abs_path'] = abs_path
                new_frame['filename'] = filename
                if not frame.get('module') and abs_path.startswith(
                        ('http:', 'https:', 'webpack:', 'app:')):
                    new_frame['module'] = generate_module(abs_path)

        elif sourcemap_url:
            new_frame['data'] = dict(new_frame.get('data') or {},
                                     sourcemap=http.expose_url(sourcemap_url))

        # TODO: theoretically a minified source could point to
        # another mapped, minified source
        changed_frame = self.expand_frame(new_frame, source=source)

        if not new_frame.get('context_line') and source:
            all_errors.append({
                'type': EventError.JS_INVALID_SOURCEMAP_LOCATION,
                # Column might be missing here
                'column': new_frame.get('colno'),
                # Line might be missing here
                'row': new_frame.get('lineno'),
                'source': new_frame['abs_path'],
            })

        changed_raw = sourcemap_applied and self.expand_frame(raw_frame)
        if sourcemap_applied or all_errors or changed_frame or \
           changed_raw:
            if in_app is not None:
                new_frame['in_app'] = in_app
                raw_frame['in_app'] = in_app
            return [new_frame], [raw_frame] if changed_raw else None, all_errors

    def expand_frame(self, frame, source=None):
        if frame.get('lineno') is not None:
            if source is None:
                source = self.get_source(frame['abs_path'])
                if source is None:
                    logger.debug('No source found for %s', frame['abs_path'])
                    return False

            frame['pre_context'], frame['context_line'], frame['post_context'] \
                = get_source_context(source=source, lineno=frame['lineno'],
                                     colno=frame.get('colno') or 0)
            return True
        return False

    def get_source(self, filename):
        if filename not in self.cache:
            self.cache_source(filename)
        return self.cache.get(filename)

    def cache_source(self, filename):
        sourcemaps = self.sourcemaps
        cache = self.cache

        self.fetch_count += 1

        if self.fetch_count > self.max_fetches:
            cache.add_error(filename, {
                'type': EventError.JS_TOO_MANY_REMOTE_SOURCES,
            })
            return

        # TODO: respect cache-control/max-age headers to some extent
        logger.debug('Fetching remote source %r', filename)
        try:
            result = fetch_file(filename, project=self.project,
                                release=self.release,
                                allow_scraping=self.allow_scraping)
        except http.BadSource as exc:
            cache.add_error(filename, exc.data)
            return

        cache.add(filename, result.body, result.encoding)
        cache.alias(result.url, filename)

        sourcemap_url = discover_sourcemap(result)
        if not sourcemap_url:
            return

        logger.debug('Found sourcemap %r for minified script %r',
                     sourcemap_url[:256], result.url)
        sourcemaps.link(filename, sourcemap_url)
        if sourcemap_url in sourcemaps:
            return

        # pull down sourcemap
        try:
            sourcemap_view = fetch_sourcemap(
                sourcemap_url,
                project=self.project,
                release=self.release,
                allow_scraping=self.allow_scraping,
            )
        except http.BadSource as exc:
            cache.add_error(filename, exc.data)
            return

        sourcemaps.add(sourcemap_url, sourcemap_view)

        # cache any inlined sources
        for src_id, source in sourcemap_view.iter_sources():
            if sourcemap_view.has_source_contents(src_id):
                self.cache.add(
                    urljoin(sourcemap_url, source),
                    lambda view=sourcemap_view, id=src_id: view.get_source_contents(id),
                    None,
                )

    def populate_source_cache(self, frames):
        """
        Fetch all sources that we know are required (being referenced directly
        in frames).
        """
        pending_file_list = set()
        for f in frames:
            # We can't even attempt to fetch source if abs_path is None
            if f.get('abs_path') is None:
                continue
            # tbh not entirely sure how this happens, but raven-js allows this
            # to be caught. I think this comes from dev consoles and whatnot
            # where there is no page. This just bails early instead of exposing
            # a fetch error that may be confusing.
            if f['abs_path'] == '<anonymous>':
                continue
            pending_file_list.add(f['abs_path'])

        for idx, filename in enumerate(pending_file_list):
            self.cache_source(
                filename=filename,
            )
