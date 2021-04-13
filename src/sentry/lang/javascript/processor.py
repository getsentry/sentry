from django.utils.encoding import force_bytes, force_text

__all__ = ["JavaScriptStacktraceProcessor"]

import base64
import errno
import logging
import re
import sys
import zlib
from os.path import splitext
from urllib.parse import urlsplit

import sentry_sdk
from django.conf import settings
from requests.utils import get_encoding_from_headers
from symbolic import SourceMapView

from sentry import http
from sentry.interfaces.stacktrace import Stacktrace
from sentry.models import EventError, Organization, ReleaseFile
from sentry.stacktraces.processing import StacktraceProcessor
from sentry.utils import metrics

# separate from either the source cache or the source maps cache, this is for
# holding the results of attempting to fetch both kinds of files, either from the
# database or from the internet
from sentry.utils.cache import cache
from sentry.utils.files import compress_file
from sentry.utils.hashlib import md5_text
from sentry.utils.http import is_valid_origin
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.safe import get_path
from sentry.utils.urls import non_standard_url_join

from .cache import SourceCache, SourceMapCache

# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5
BASE64_SOURCEMAP_PREAMBLE = "data:application/json;base64,"
BASE64_PREAMBLE_LENGTH = len(BASE64_SOURCEMAP_PREAMBLE)
UNKNOWN_MODULE = "<unknown module>"
CLEAN_MODULE_RE = re.compile(
    r"""^
(?:/|  # Leading slashes
(?:
    (?:java)?scripts?|js|build|static|node_modules|bower_components|[_\.~].*?|  # common folder prefixes
    v?(?:\d+\.)*\d+|   # version numbers, v1, 1.0.0
    [a-f0-9]{7,8}|     # short sha
    [a-f0-9]{32}|      # md5
    [a-f0-9]{40}       # sha1
)/)+|
(?:[-\.][a-f0-9]{7,}$)  # Ending in a commitish
""",
    re.X | re.I,
)
VERSION_RE = re.compile(r"^[a-f0-9]{32}|[a-f0-9]{40}$", re.I)
NODE_MODULES_RE = re.compile(r"\bnode_modules/")
SOURCE_MAPPING_URL_RE = re.compile(b"//# sourceMappingURL=(.*)$")
CACHE_CONTROL_RE = re.compile(r"max-age=(\d+)")
CACHE_CONTROL_MAX = 7200
CACHE_CONTROL_MIN = 60
# the maximum number of remote resources (i.e. source files) that should be
# fetched
MAX_RESOURCE_FETCHES = 100

CACHE_MAX_VALUE_SIZE = settings.SENTRY_CACHE_MAX_VALUE_SIZE

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
    line = line.strip("\n")
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
        line += " {snip}"
    if start > 0:
        # we've snipped from the beginning
        line = "{snip} " + line
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
        context_line = ""

    try:
        post_context = [trim_line(x) for x in source[(lineno + 1) : upper_bound]]
    except IndexError:
        post_context = []

    return pre_context or None, context_line, post_context or None


def discover_sourcemap(result):
    """
    Given a UrlResult object, attempt to discover a sourcemap URL.
    """
    # When coercing the headers returned by urllib to a dict
    # all keys become lowercase so they're normalized
    sourcemap = result.headers.get("sourcemap", result.headers.get("x-sourcemap"))

    # Force the header value to bytes since we'll be manipulating bytes here
    sourcemap = force_bytes(sourcemap) if sourcemap is not None else None

    if not sourcemap:
        parsed_body = result.body.split(b"\n")
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
            if line[:21] in (b"//# sourceMappingURL=", b"//@ sourceMappingURL="):
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
        if b"/*" in sourcemap and sourcemap[-2:] == b"*/":
            index = sourcemap.index(b"/*")
            # comment definitely shouldn't be the first character,
            # so let's just make sure of that.
            if index == 0:
                raise AssertionError(
                    "react-native comment found at bad location: %d, %r" % (index, sourcemap)
                )
            sourcemap = sourcemap[:index]
        # fix url so its absolute
        sourcemap = non_standard_url_join(result.url, force_text(sourcemap))

    return force_text(sourcemap) if sourcemap is not None else None


def get_release_file_cache_key(release_id, releasefile_ident):
    return f"releasefile:v1:{release_id}:{releasefile_ident}"


def get_release_file_cache_key_meta(release_id, releasefile_ident):
    return "meta:%s" % get_release_file_cache_key(release_id, releasefile_ident)


MAX_FETCH_ATTEMPTS = 3


def should_retry_fetch(attempt: int, e: Exception) -> bool:
    return not attempt > MAX_FETCH_ATTEMPTS and isinstance(e, OSError) and e.errno == errno.ESTALE


fetch_retry_policy = ConditionalRetryPolicy(should_retry_fetch, exponential_delay(0.05))


def fetch_release_file(filename, release, dist=None):
    """
    Attempt to retrieve a release artifact from the database.

    Caches the result of that attempt (whether successful or not).
    """

    dist_name = dist and dist.name or None
    releasefile_ident = ReleaseFile.get_ident(filename, dist_name)
    cache_key = get_release_file_cache_key(
        release_id=release.id, releasefile_ident=releasefile_ident
    )
    # Cache key to store file metadata, currently only the size of the
    # compressed version of file. We cannot use the cache_key because large
    # payloads (silently) fail to cache due to e.g. memcached payload size
    # limitation and we use the meta data to avoid compression of such a files.
    cache_key_meta = get_release_file_cache_key_meta(
        release_id=release.id, releasefile_ident=releasefile_ident
    )

    logger.debug("Checking cache for release artifact %r (release_id=%s)", filename, release.id)
    result = cache.get(cache_key)

    # not in the cache (meaning we haven't checked the database recently), so check the database
    if result is None:
        filename_choices = ReleaseFile.normalize(filename)
        filename_idents = [ReleaseFile.get_ident(f, dist_name) for f in filename_choices]

        logger.debug(
            "Checking database for release artifact %r (release_id=%s)", filename, release.id
        )

        possible_files = list(
            ReleaseFile.objects.filter(
                release=release, dist=dist, ident__in=filename_idents
            ).select_related("file")
        )

        if len(possible_files) == 0:
            logger.debug(
                "Release artifact %r not found in database (release_id=%s)", filename, release.id
            )
            cache.set(cache_key, -1, 60)
            return None

        elif len(possible_files) == 1:
            releasefile = possible_files[0]

        else:
            # Pick first one that matches in priority order.
            # This is O(N*M) but there are only ever at most 4 things here
            # so not really worth optimizing.
            releasefile = next(
                rf for ident in filename_idents for rf in possible_files if rf.ident == ident
            )

        logger.debug(
            "Found release artifact %r (id=%s, release_id=%s)", filename, releasefile.id, release.id
        )

        # If the release file is not in cache, check if we can retrieve at
        # least the size metadata from cache and prevent compression and
        # caching if payload exceeds the backend limit.
        z_body_size = None

        if CACHE_MAX_VALUE_SIZE:
            cache_meta = cache.get(cache_key_meta)
            if cache_meta:
                z_body_size = int(cache_meta.get("compressed_size"))

        def fetch_release_body():
            with ReleaseFile.cache.getfile(releasefile) as fp:
                if z_body_size and z_body_size > CACHE_MAX_VALUE_SIZE:
                    return None, fp.read()
                else:
                    return compress_file(fp)

        try:
            with metrics.timer("sourcemaps.release_file_read"):
                z_body, body = fetch_retry_policy(fetch_release_body)
        except Exception:
            logger.error("sourcemap.compress_read_failed", exc_info=sys.exc_info())
            result = None
        else:
            headers = {k.lower(): v for k, v in releasefile.file.headers.items()}
            encoding = get_encoding_from_headers(headers)
            result = http.UrlResult(filename, headers, body, 200, encoding)

            # If we don't have the compressed body for caching because the
            # cached metadata said it is too large payload for the cache
            # backend, do not attempt to cache.
            if z_body:
                # This will implicitly skip too large payloads. Those will be cached
                # on the file system by `ReleaseFile.cache`, instead.
                cache.set(cache_key, (headers, z_body, 200, encoding), 3600)

                # In case the previous call to cache implicitly fails, we use
                # the meta data to avoid pointless compression which is done
                # only for caching.
                cache.set(cache_key_meta, {"compressed_size": len(z_body)}, 3600)

    # in the cache as an unsuccessful attempt
    elif result == -1:
        result = None

    # in the cache as a successful attempt, including the zipped contents of the file
    else:
        # Previous caches would be a 3-tuple instead of a 4-tuple,
        # so this is being maintained for backwards compatibility
        try:
            encoding = result[3]
        except IndexError:
            encoding = None
        result = http.UrlResult(
            filename, result[0], zlib.decompress(result[1]), result[2], encoding
        )

    return result


def fetch_file(url, project=None, release=None, dist=None, allow_scraping=True):
    """
    Pull down a URL, returning a UrlResult object.

    Attempts to fetch from the database first (assuming there's a release on the
    event), then the internet. Caches the result of each of those two attempts
    separately, whether or not those attempts are successful. Used for both
    source files and source maps.
    """

    # If our url has been truncated, it'd be impossible to fetch
    # so we check for this early and bail
    if url[-3:] == "...":
        raise http.CannotFetch({"type": EventError.JS_MISSING_SOURCE, "url": http.expose_url(url)})

    # if we've got a release to look on, try that first (incl associated cache)
    if release:
        with metrics.timer("sourcemaps.release_file"):
            result = fetch_release_file(url, release, dist)
    else:
        result = None

    # otherwise, try the web-scraping cache and then the web itself

    cache_key = f"source:cache:v4:{md5_text(url).hexdigest()}"

    if result is None:
        if not allow_scraping or not url.startswith(("http:", "https:")):
            error = {"type": EventError.JS_MISSING_SOURCE, "url": http.expose_url(url)}
            raise http.CannotFetch(error)

        logger.debug("Checking cache for url %r", url)
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
            result = http.UrlResult(
                result[0], result[1], zlib.decompress(result[2]), result[3], encoding
            )

    if result is None:
        headers = {}
        verify_ssl = False
        if project and is_valid_origin(url, project=project):
            verify_ssl = bool(project.get_option("sentry:verify_ssl", False))
            token = project.get_option("sentry:token")
            if token:
                token_header = project.get_option("sentry:token_header") or "X-Sentry-Token"
                headers[token_header] = token

        with metrics.timer("sourcemaps.fetch"):
            result = http.fetch_file(url, headers=headers, verify_ssl=verify_ssl)
            z_body = zlib.compress(result.body)
            cache.set(
                cache_key,
                (url, result.headers, z_body, result.status, result.encoding),
                get_max_age(result.headers),
            )

            # since the cache.set above can fail we can end up in a situation
            # where the file is too large for the cache. In that case we abort
            # the fetch and cache a failure and lock the domain for future
            # http fetches.
            if cache.get(cache_key) is None:
                error = {
                    "type": EventError.TOO_LARGE_FOR_CACHE,
                    "url": http.expose_url(url),
                }
                http.lock_domain(url, error=error)
                raise http.CannotFetch(error)

    # If we did not get a 200 OK we just raise a cannot fetch here.
    if result.status != 200:
        raise http.CannotFetch(
            {
                "type": EventError.FETCH_INVALID_HTTP_CODE,
                "value": result.status,
                "url": http.expose_url(url),
            }
        )

    # Make sure the file we're getting back is bytes. The only
    # reason it'd not be binary would be from old cached blobs, so
    # for compatibility with current cached files, let's coerce back to
    # binary and say utf8 encoding.
    if not isinstance(result.body, bytes):
        try:
            result = http.UrlResult(
                result.url,
                result.headers,
                result.body.encode("utf8"),
                result.status,
                result.encoding,
            )
        except UnicodeEncodeError:
            error = {
                "type": EventError.FETCH_INVALID_ENCODING,
                "value": "utf8",
                "url": http.expose_url(url),
            }
            raise http.CannotFetch(error)

    # For JavaScript files, check if content is something other than JavaScript/JSON (i.e. HTML)
    # NOTE: possible to have JS files that don't actually end w/ ".js", but
    # this should catch 99% of cases
    if urlsplit(url).path.endswith(".js"):
        # Check if response is HTML by looking if the first non-whitespace character is an open tag ('<').
        # This cannot parse as valid JS/JSON.
        # NOTE: not relying on Content-Type header because apps often don't set this correctly
        # Discard leading whitespace (often found before doctype)
        body_start = result.body[:20].lstrip()

        if body_start[:1] == b"<":
            error = {"type": EventError.JS_INVALID_CONTENT, "url": url}
            raise http.CannotFetch(error)

    return result


def get_max_age(headers):
    cache_control = headers.get("cache-control")
    max_age = CACHE_CONTROL_MIN

    if cache_control:
        match = CACHE_CONTROL_RE.search(cache_control)
        if match:
            max_age = max(CACHE_CONTROL_MIN, int(match.group(1)))
    return min(max_age, CACHE_CONTROL_MAX)


def fetch_sourcemap(url, project=None, release=None, dist=None, allow_scraping=True):
    if is_data_uri(url):
        try:
            body = base64.b64decode(
                force_bytes(url[BASE64_PREAMBLE_LENGTH:])
                + (b"=" * (-(len(url) - BASE64_PREAMBLE_LENGTH) % 4))
            )
        except TypeError as e:
            raise UnparseableSourcemap({"url": "<base64>", "reason": str(e)})
    else:
        # look in the database and, if not found, optionally try to scrape the web
        result = fetch_file(
            url, project=project, release=release, dist=dist, allow_scraping=allow_scraping
        )
        body = result.body
    try:
        return SourceMapView.from_json_bytes(body)
    except Exception as exc:
        # This is in debug because the product shows an error already.
        logger.debug(str(exc), exc_info=True)
        raise UnparseableSourcemap({"url": http.expose_url(url)})


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
    if filename.endswith(".min"):
        filename = filename[:-4]

    # TODO(dcramer): replace CLEAN_MODULE_RE with tokenizer completely
    tokens = filename.split("/")
    for idx, token in enumerate(tokens):
        # a SHA
        if VERSION_RE.match(token):
            return "/".join(tokens[idx + 1 :])

    return CLEAN_MODULE_RE.sub("", filename) or UNKNOWN_MODULE


def is_valid_frame(frame):
    return frame is not None and frame.get("lineno") is not None


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

        # Make sure we only fetch organization from cache
        # We don't need to persist it back since we don't want
        # to bloat the Event object.
        organization = getattr(self.project, "_organization_cache", None)
        if not organization:
            organization = Organization.objects.get_from_cache(id=self.project.organization_id)

        self.max_fetches = MAX_RESOURCE_FETCHES
        self.allow_scraping = organization.get_option(
            "sentry:scrape_javascript", True
        ) is not False and self.project.get_option("sentry:scrape_javascript", True)
        self.fetch_count = 0
        self.sourcemaps_touched = set()

        # cache holding mangled code, original code, and errors associated with
        # each abs_path in the stacktrace
        self.cache = SourceCache()

        # cache holding source URLs, corresponding source map URLs, and source map contents
        self.sourcemaps = SourceMapCache()

        self.release = None
        self.dist = None

    def get_stacktraces(self, data):
        exceptions = get_path(data, "exception", "values", filter=True, default=())
        stacktraces = [e["stacktrace"] for e in exceptions if e.get("stacktrace")]

        if "stacktrace" in data:
            stacktraces.append(data["stacktrace"])

        return [(s, Stacktrace.to_python(s)) for s in stacktraces]

    def get_valid_frames(self):
        # build list of frames that we can actually grab source for
        frames = []
        for info in self.stacktrace_infos:
            frames.extend(get_path(info.stacktrace, "frames", filter=is_valid_frame, default=()))
        return frames

    def preprocess_step(self, processing_task):
        frames = self.get_valid_frames()
        if not frames:
            logger.debug(
                "Event %r has no frames with enough context to " "fetch remote source",
                self.data["event_id"],
            )
            return False

        with sentry_sdk.start_span(op="JavaScriptStacktraceProcessor.preprocess_step.get_release"):
            self.release = self.get_release(create=True)
            if self.data.get("dist") and self.release:
                self.dist = self.release.get_dist(self.data["dist"])

        with sentry_sdk.start_span(
            op="JavaScriptStacktraceProcessor.preprocess_step.populate_source_cache"
        ):
            self.populate_source_cache(frames)
        return True

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get("platform") or self.data.get("platform")
        return settings.SENTRY_SCRAPE_JAVASCRIPT_CONTEXT and platform in ("javascript", "node")

    def preprocess_frame(self, processable_frame):
        # Stores the resolved token.  This is used to cross refer to other
        # frames for function name resolution by call site.
        processable_frame.data = {"token": None}

    def process_frame(self, processable_frame, processing_task):
        """
        Attempt to demangle the given frame.
        """

        frame = processable_frame.frame
        token = None

        cache = self.cache
        sourcemaps = self.sourcemaps
        all_errors = []
        sourcemap_applied = False

        # can't demangle if there's no filename or line number present
        if not frame.get("abs_path") or not frame.get("lineno"):
            return

        # also can't demangle node's internal modules
        # therefore we only process user-land frames (starting with /)
        # or those created by bundle/webpack internals
        if self.data.get("platform") == "node" and not frame.get("abs_path").startswith(
            ("/", "app:", "webpack:")
        ):
            return

        errors = cache.get_errors(frame["abs_path"])
        if errors:
            all_errors.extend(errors)

        # This might fail but that's okay, we try with a different path a
        # bit later down the road.
        source = self.get_sourceview(frame["abs_path"])

        in_app = None
        new_frame = dict(frame)
        raw_frame = dict(frame)

        sourcemap_url, sourcemap_view = sourcemaps.get_link(frame["abs_path"])
        self.sourcemaps_touched.add(sourcemap_url)
        if sourcemap_view and frame.get("colno") is None:
            all_errors.append(
                {"type": EventError.JS_NO_COLUMN, "url": http.expose_url(frame["abs_path"])}
            )
        elif sourcemap_view:
            if is_data_uri(sourcemap_url):
                sourcemap_label = frame["abs_path"]
            else:
                sourcemap_label = sourcemap_url

            sourcemap_label = http.expose_url(sourcemap_label)

            if frame.get("function"):
                minified_function_name = frame["function"]
                minified_source = self.get_sourceview(frame["abs_path"])
            else:
                minified_function_name = minified_source = None

            try:
                # Errors are 1-indexed in the frames, so we need to -1 to get
                # zero-indexed value from tokens.
                assert frame["lineno"] > 0, "line numbers are 1-indexed"
                token = sourcemap_view.lookup(
                    frame["lineno"] - 1, frame["colno"] - 1, minified_function_name, minified_source
                )
            except Exception:
                token = None
                all_errors.append(
                    {
                        "type": EventError.JS_INVALID_SOURCEMAP_LOCATION,
                        "column": frame.get("colno"),
                        "row": frame.get("lineno"),
                        "source": frame["abs_path"],
                        "sourcemap": sourcemap_label,
                    }
                )

            # persist the token so that we can find it later
            processable_frame.data["token"] = token

            # Store original data in annotation
            new_frame["data"] = dict(frame.get("data") or {}, sourcemap=sourcemap_label)

            sourcemap_applied = True

            if token is not None:
                abs_path = non_standard_url_join(sourcemap_url, token.src)

                logger.debug(
                    "Mapping compressed source %r to mapping in %r", frame["abs_path"], abs_path
                )
                source = self.get_sourceview(abs_path)

            if source is None:
                errors = cache.get_errors(abs_path)
                if errors:
                    all_errors.extend(errors)
                else:
                    all_errors.append(
                        {"type": EventError.JS_MISSING_SOURCE, "url": http.expose_url(abs_path)}
                    )

            if token is not None:
                # the tokens are zero indexed, so offset correctly
                new_frame["lineno"] = token.src_line + 1
                new_frame["colno"] = token.src_col + 1

                # Try to use the function name we got from symbolic
                original_function_name = token.function_name

                # In the ideal case we can use the function name from the
                # frame and the location to resolve the original name
                # through the heuristics in our sourcemap library.
                if original_function_name is None:
                    last_token = None

                    # Find the previous token for function name handling as a
                    # fallback.
                    if (
                        processable_frame.previous_frame
                        and processable_frame.previous_frame.processor is self
                    ):
                        last_token = processable_frame.previous_frame.data.get("token")
                        if last_token:
                            original_function_name = last_token.name

                if original_function_name is not None:
                    new_frame["function"] = original_function_name

                filename = token.src
                # special case webpack support
                # abs_path will always be the full path with webpack:/// prefix.
                # filename will be relative to that
                if abs_path.startswith("webpack:"):
                    filename = abs_path
                    # webpack seems to use ~ to imply "relative to resolver root"
                    # which is generally seen for third party deps
                    # (i.e. node_modules)
                    if "/~/" in filename:
                        filename = "~/" + abs_path.split("/~/", 1)[-1]
                    else:
                        filename = filename.split("webpack:///", 1)[-1]

                    # As noted above:
                    # * [js/node] '~/' means they're coming from node_modules, so these are not app dependencies
                    # * [node] sames goes for `./node_modules/` and '../node_modules/', which is used when bundling node apps
                    # * [node] and webpack, which includes it's own code to bootstrap all modules and its internals
                    #   eg. webpack:///webpack/bootstrap, webpack:///external
                    if (
                        filename.startswith("~/")
                        or "/node_modules/" in filename
                        or not filename.startswith("./")
                    ):
                        in_app = False
                    # And conversely, local dependencies start with './'
                    elif filename.startswith("./"):
                        in_app = True
                    # We want to explicitly generate a webpack module name
                    new_frame["module"] = generate_module(filename)

                # while you could technically use a subpath of 'node_modules' for your libraries,
                # it would be an extremely complicated decision and we've not seen anyone do it
                # so instead we assume if node_modules is in the path its part of the vendored code
                elif "/node_modules/" in abs_path:
                    in_app = False

                if abs_path.startswith("app:"):
                    if filename and NODE_MODULES_RE.search(filename):
                        in_app = False
                    else:
                        in_app = True

                new_frame["abs_path"] = abs_path
                new_frame["filename"] = filename
                if not frame.get("module") and abs_path.startswith(
                    ("http:", "https:", "webpack:", "app:")
                ):
                    new_frame["module"] = generate_module(abs_path)

        elif sourcemap_url:
            new_frame["data"] = dict(
                new_frame.get("data") or {}, sourcemap=http.expose_url(sourcemap_url)
            )

        # TODO: theoretically a minified source could point to
        # another mapped, minified source
        changed_frame = self.expand_frame(new_frame, source=source)

        # If we did not manage to match but we do have a line or column
        # we want to report an error here.
        if not new_frame.get("context_line") and source and new_frame.get("colno") is not None:
            all_errors.append(
                {
                    "type": EventError.JS_INVALID_SOURCEMAP_LOCATION,
                    "column": new_frame["colno"],
                    "row": new_frame["lineno"],
                    "source": new_frame["abs_path"],
                }
            )

        changed_raw = sourcemap_applied and self.expand_frame(raw_frame)

        if sourcemap_applied or all_errors or changed_frame or changed_raw:
            # In case we are done processing, we iterate over all errors that we got
            # and we filter out all `JS_MISSING_SOURCE` errors since we consider if we have
            # a `context_line` we have a symbolicated frame and we don't need to show the error
            has_context_line = bool(new_frame.get("context_line"))
            if has_context_line:
                all_errors[:] = [
                    x for x in all_errors if x.get("type") is not EventError.JS_MISSING_SOURCE
                ]

            if in_app is not None:
                new_frame["in_app"] = in_app
                raw_frame["in_app"] = in_app

            new_frames = [new_frame]
            raw_frames = [raw_frame] if changed_raw else None
            return new_frames, raw_frames, all_errors

    def expand_frame(self, frame, source=None):
        """
        Mutate the given frame to include pre- and post-context lines.
        """

        if frame.get("lineno") is not None:
            if source is None:
                source = self.get_sourceview(frame["abs_path"])
                if source is None:
                    logger.debug("No source found for %s", frame["abs_path"])
                    return False

            frame["pre_context"], frame["context_line"], frame["post_context"] = get_source_context(
                source=source, lineno=frame["lineno"], colno=frame.get("colno") or 0
            )
            return True
        return False

    def get_sourceview(self, filename):
        if filename not in self.cache:
            self.cache_source(filename)
        return self.cache.get(filename)

    def cache_source(self, filename):
        """
        Look for and (if found) cache a source file and its associated source
        map (if any).
        """

        sourcemaps = self.sourcemaps
        cache = self.cache

        self.fetch_count += 1

        if self.fetch_count > self.max_fetches:
            cache.add_error(filename, {"type": EventError.JS_TOO_MANY_REMOTE_SOURCES})
            return

        # TODO: respect cache-control/max-age headers to some extent
        logger.debug("Attempting to cache source %r", filename)
        try:
            # this both looks in the database and tries to scrape the internet
            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.cache_source.fetch_file"
            ) as span:
                span.set_data("filename", filename)
                result = fetch_file(
                    filename,
                    project=self.project,
                    release=self.release,
                    dist=self.dist,
                    allow_scraping=self.allow_scraping,
                )
        except http.BadSource as exc:
            # most people don't upload release artifacts for their third-party libraries,
            # so ignore missing node_modules files
            if exc.data["type"] == EventError.JS_MISSING_SOURCE and "node_modules" in filename:
                pass
            else:
                cache.add_error(filename, exc.data)

            # either way, there's no more for us to do here, since we don't have
            # a valid file to cache
            return
        cache.add(filename, result.body, result.encoding)
        cache.alias(result.url, filename)

        sourcemap_url = discover_sourcemap(result)
        if not sourcemap_url:
            return

        logger.debug(
            "Found sourcemap URL %r for minified script %r", sourcemap_url[:256], result.url
        )
        sourcemaps.link(filename, sourcemap_url)
        if sourcemap_url in sourcemaps:
            return

        # pull down sourcemap
        try:
            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.cache_source.fetch_sourcemap"
            ) as span:
                span.set_data("sourcemap_url", sourcemap_url)
                sourcemap_view = fetch_sourcemap(
                    sourcemap_url,
                    project=self.project,
                    release=self.release,
                    dist=self.dist,
                    allow_scraping=self.allow_scraping,
                )
        except http.BadSource as exc:
            # we don't perform the same check here as above, because if someone has
            # uploaded a node_modules file, which has a sourceMappingURL, they
            # presumably would like it mapped (and would like to know why it's not
            # working, if that's the case). If they're not looking for it to be
            # mapped, then they shouldn't be uploading the source file in the
            # first place.
            cache.add_error(filename, exc.data)
            return

        sourcemaps.add(sourcemap_url, sourcemap_view)

        # cache any inlined sources
        for src_id, source_name in sourcemap_view.iter_sources():
            source_view = sourcemap_view.get_sourceview(src_id)
            if source_view is not None:
                self.cache.add(non_standard_url_join(sourcemap_url, source_name), source_view)

    def populate_source_cache(self, frames):
        """
        Fetch all sources that we know are required (being referenced directly
        in frames).
        """
        pending_file_list = set()
        for f in frames:
            # We can't even attempt to fetch source if abs_path is None
            if f.get("abs_path") is None:
                continue
            # tbh not entirely sure how this happens, but raven-js allows this
            # to be caught. I think this comes from dev consoles and whatnot
            # where there is no page. This just bails early instead of exposing
            # a fetch error that may be confusing.
            if f["abs_path"] == "<anonymous>":
                continue
            # we cannot fetch any other files than those uploaded by user
            if self.data.get("platform") == "node" and not f.get("abs_path").startswith("app:"):
                continue
            pending_file_list.add(f["abs_path"])

        for idx, filename in enumerate(pending_file_list):
            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.populate_source_cache.cache_source"
            ) as span:
                span.set_data("filename", filename)
                self.cache_source(filename=filename)

    def close(self):
        StacktraceProcessor.close(self)
        if self.sourcemaps_touched:
            metrics.incr(
                "sourcemaps.processed", amount=len(self.sourcemaps_touched), skip_internal=True
            )
