import base64
import binascii
import errno
import logging
import re
import sys
import time
import zlib
from datetime import datetime
from enum import Enum
from io import BytesIO
from itertools import groupby
from os.path import splitext
from typing import IO, Callable, Optional, Tuple
from urllib.parse import urlsplit

import sentry_sdk
from django.conf import settings
from django.utils import timezone
from django.utils.encoding import force_bytes, force_text
from requests.utils import get_encoding_from_headers
from symbolic import SourceMapCache as SmCache
from symbolic import SourceView

from sentry import features, http, options
from sentry.event_manager import set_tag
from sentry.models import (
    NULL_STRING,
    ArtifactBundle,
    ArtifactBundleArchive,
    EventError,
    Organization,
    ReleaseFile,
    SourceFileType,
)
from sentry.models.releasefile import ARTIFACT_INDEX_FILENAME, ReleaseArchive, read_artifact_index
from sentry.stacktraces.processing import StacktraceProcessor
from sentry.utils import json, metrics

# separate from either the source cache or the source maps cache, this is for
# holding the results of attempting to fetch both kinds of files, either from the
# database or from the internet
from sentry.utils.cache import cache
from sentry.utils.files import compress_file
from sentry.utils.hashlib import md5_text
from sentry.utils.http import is_valid_origin
from sentry.utils.javascript import find_sourcemap
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.safe import get_path
from sentry.utils.urls import non_standard_url_join

__all__ = ["JavaScriptStacktraceProcessor"]

# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5
BASE64_SOURCEMAP_PREAMBLE = "data:application/json;base64,"
BASE64_PREAMBLE_LENGTH = len(BASE64_SOURCEMAP_PREAMBLE)
UNKNOWN_MODULE = "<unknown module>"
# Names that do not provide any reasonable value, and that can possibly obstruct
# better available names. In case we encounter one, we fallback to current frame fn name if available.
USELESS_FN_NAMES = ["<anonymous>", "__webpack_require__", "__webpack_modules__"]
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
# Default Webpack output path using multiple namespace - https://webpack.js.org/configuration/output/#outputdevtoolmodulefilenametemplate
# eg. webpack://myproject/./src/lib/hellothere.js
WEBPACK_NAMESPACE_RE = re.compile(r"^webpack://[a-zA-Z0-9_\-@\.]+/\./")
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


def fetch_error_should_be_silienced(exc_data, filename):
    # most people don't upload release artifacts for their third-party libraries,
    # so ignore missing node_modules files or chrome extensions
    return exc_data["type"] == EventError.JS_MISSING_SOURCE and (
        "node_modules" in filename or (exc_data.get("url") or "").startswith("chrome-extension:")
    )


def get_source_context(source, lineno, context=LINES_OF_CONTEXT):
    if not source:
        return None, None, None

    # lineno's in JS are 1-indexed
    # just in case. sometimes math is hard
    if lineno > 0:
        lineno -= 1

    lower_bound = max(0, lineno - context)
    upper_bound = min(lineno + 1 + context, len(source))

    try:
        pre_context = source[lower_bound:lineno]
    except IndexError:
        pre_context = []

    try:
        context_line = source[lineno]
    except IndexError:
        context_line = ""

    try:
        post_context = source[(lineno + 1) : upper_bound]
    except IndexError:
        post_context = []

    return pre_context or None, context_line, post_context or None


def discover_sourcemap(result):
    """
    Given a UrlResult object, attempt to discover a sourcemap URL.
    """
    # There might be a scenario where `abs_path` of the frame points to the page
    # route itself, like https://sentry.io/something (eg. when inlined script throws).
    # In this case, we would normally skip mapping this frame, as there's no way to
    # do that in the first place. However some developers, have their tools configured,
    # so that inlined script end up with `sourceMappingURL` pragma at the end of their
    # HTML page. When this happen, we'll detect it as a valid sourcemap, and assign
    # malformed url like https://sentry.io/assets/vendor.42.js.map</script></body></html>
    # as the discovered sourcemap url. This check tries to prevent that from happening.
    if is_html_response(result):
        return None

    # When coercing the headers returned by urllib to a dict
    # all keys become lowercase so they're normalized
    sourcemap_header = result.headers.get("sourcemap", result.headers.get("x-sourcemap"))

    # Force the header value to bytes since we'll be manipulating bytes here
    sourcemap_header = force_bytes(sourcemap_header) if sourcemap_header is not None else None
    sourcemap_url = find_sourcemap(sourcemap_header, result.body)
    sourcemap_url = (
        force_text(non_standard_url_join(result.url, force_text(sourcemap_url)))
        if sourcemap_url is not None
        else None
    )

    return sourcemap_url


def get_release_file_cache_key(release_id, releasefile_ident):
    return f"releasefile:v1:{release_id}:{releasefile_ident}"


def get_release_file_cache_key_meta(release_id, releasefile_ident):
    return "meta:%s" % get_release_file_cache_key(release_id, releasefile_ident)


def get_artifact_bundle_with_release_cache_key(release_id, artifact_bundle_ident):
    return f"artifactbundlefile:v1:{release_id}:{artifact_bundle_ident}"


def get_artifact_bundle_with_release_cache_key_meta(release_id, artifact_bundle_ident):
    return "meta:%s" % get_artifact_bundle_with_release_cache_key(release_id, artifact_bundle_ident)


def get_artifact_bundle_cache_key(artifact_bundle_id):
    return f"artifactbundle:v1:{artifact_bundle_id}"


MAX_FETCH_ATTEMPTS = 3


def should_retry_fetch(attempt: int, e: Exception) -> bool:
    return not attempt > MAX_FETCH_ATTEMPTS and isinstance(e, OSError) and e.errno == errno.ESTALE


fetch_retry_policy = ConditionalRetryPolicy(should_retry_fetch, exponential_delay(0.05))


def fetch_and_cache_artifact(result_url, fetch_fn, cache_key, cache_key_meta, headers, compress_fn):
    # If the release file is not in cache, check if we can retrieve at
    # least the size metadata from cache and prevent compression and
    # caching if payload exceeds the backend limit.
    z_body_size = None

    if CACHE_MAX_VALUE_SIZE:
        cache_meta = cache.get(cache_key_meta)
        if cache_meta:
            z_body_size = int(cache_meta.get("compressed_size"))

    def fetch_release_body():
        with fetch_fn() as fp:
            # We want to avoid performing compression in case we have None cache keys or the size of the compressed body
            # is more than the limit.
            if (cache_key is None and cache_key_meta is None) or (
                z_body_size and z_body_size > CACHE_MAX_VALUE_SIZE
            ):
                return None, fp.read()
            else:
                with sentry_sdk.start_span(
                    op="JavaScriptStacktraceProcessor.fetch_and_cache_artifact.compress"
                ):
                    return compress_fn(fp)

    try:
        with metrics.timer("sourcemaps.release_file_read"):
            z_body, body = fetch_retry_policy(fetch_release_body)
    except Exception:
        logger.error("sourcemap.compress_read_failed", exc_info=sys.exc_info())
        result = None
    else:
        headers = {k.lower(): v for k, v in headers.items()}
        encoding = get_encoding_from_headers(headers)
        result = http.UrlResult(result_url, headers, body, 200, encoding)

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

    return result


def get_cache_keys(filename, release, dist):
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

    return cache_key, cache_key_meta


def get_cache_keys_new(url, release, dist):
    dist_name = dist and dist.name or None
    artifact_bundle_ident = ArtifactBundle.get_ident(url, dist_name)
    cache_key = get_artifact_bundle_with_release_cache_key(
        release_id=release.id, artifact_bundle_ident=artifact_bundle_ident
    )
    cache_key_meta = get_artifact_bundle_with_release_cache_key_meta(
        release_id=release.id, artifact_bundle_ident=artifact_bundle_ident
    )
    return cache_key, cache_key_meta


def result_from_cache(url, result):
    # Previous caches would be a 3-tuple instead of a 4-tuple,
    # so this is being maintained for backwards compatibility
    try:
        encoding = result[3]
    except IndexError:
        encoding = None

    return http.UrlResult(url, result[0], zlib.decompress(result[1]), result[2], encoding)


@metrics.wraps("sourcemaps.release_file")
def fetch_release_file(filename, release, dist=None):
    """
    Attempt to retrieve a release artifact from the database.

    Caches the result of that attempt (whether successful or not).
    """
    dist_name = dist and dist.name or None
    cache_key, cache_key_meta = get_cache_keys(filename, release, dist)

    logger.debug("Checking cache for release artifact %r (release_id=%s)", filename, release.id)
    result = cache.get(cache_key)

    # not in the cache (meaning we haven't checked the database recently), so check the database
    if result is None:
        with metrics.timer("sourcemaps.release_artifact_from_file"):
            filename_choices = ReleaseFile.normalize(filename)
            filename_idents = [ReleaseFile.get_ident(f, dist_name) for f in filename_choices]

            logger.debug(
                "Checking database for release artifact %r (release_id=%s)", filename, release.id
            )

            possible_files = list(
                ReleaseFile.objects.filter(
                    release_id=release.id,
                    dist_id=dist.id if dist else dist,
                    ident__in=filename_idents,
                ).select_related("file")
            )

            if len(possible_files) == 0:
                logger.debug(
                    "Release artifact %r not found in database (release_id=%s)",
                    filename,
                    release.id,
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
                "Found release artifact %r (id=%s, release_id=%s)",
                filename,
                releasefile.id,
                release.id,
            )

            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.fetch_release_file.fetch_and_cache"
            ):
                result = fetch_and_cache_artifact(
                    filename,
                    lambda: ReleaseFile.cache.getfile(releasefile),
                    cache_key,
                    cache_key_meta,
                    releasefile.file.headers,
                    compress_file,
                )

    # in the cache as an unsuccessful attempt
    elif result == -1:
        result = None

    # in the cache as a successful attempt, including the zipped contents of the file
    else:
        result = result_from_cache(filename, result)

    return result


@metrics.wraps("sourcemaps.get_from_archive")
def try_get_with_normalized_urls(
    url: str, block: Callable[[str], Tuple[bytes, dict]]
) -> Tuple[bytes, dict]:
    candidates = ReleaseFile.normalize(url)
    for candidate in candidates:
        try:
            return block(candidate)
        except KeyError:
            pass

    # None of the filenames matched
    raise KeyError(f"Not found in archive: '{url}'")


@metrics.wraps("sourcemaps.load_artifact_index")
def get_artifact_index(release, dist):
    dist_name = dist and dist.name or None

    ident = ReleaseFile.get_ident(ARTIFACT_INDEX_FILENAME, dist_name)
    cache_key = f"artifact-index:v1:{release.id}:{ident}"
    result = cache.get(cache_key)
    if result == -1:
        index = None
    elif result:
        index = json.loads(result)
    else:
        index = read_artifact_index(release, dist, use_cache=True)
        cache_value = -1 if index is None else json.dumps(index)
        # Only cache for a short time to keep the manifest up-to-date
        cache.set(cache_key, cache_value, timeout=60)

    return index


def get_index_entry(release, dist, url) -> Optional[dict]:
    try:
        index = get_artifact_index(release, dist)
    except Exception as exc:
        logger.error("sourcemaps.index_read_failed", exc_info=exc)
        return None

    if index:
        for candidate in ReleaseFile.normalize(url):
            entry = index.get("files", {}).get(candidate)
            if entry:
                return entry

    return None


@metrics.wraps("sourcemaps.fetch_release_archive")
def fetch_release_archive_for_url(release, dist, url) -> Optional[IO]:
    """Fetch release archive and cache if possible.

    Multiple archives might have been uploaded, so we need the URL
    to get the correct archive from the artifact index.

    If return value is not empty, the caller is responsible for closing the stream.
    """
    with sentry_sdk.start_span(op="fetch_release_archive_for_url.get_index_entry"):
        info = get_index_entry(release, dist, url)
    if info is None:
        # Cannot write negative cache entry here because ID of release archive
        # is not yet known
        return None

    archive_ident = info["archive_ident"]

    # TODO(jjbayer): Could already extract filename from info and return
    # it later

    cache_key = get_release_file_cache_key(release_id=release.id, releasefile_ident=archive_ident)

    result = cache.get(cache_key)

    if result == -1:
        return None
    elif result:
        return BytesIO(result)
    else:
        try:
            with sentry_sdk.start_span(op="fetch_release_archive_for_url.get_releasefile_db_entry"):
                qs = ReleaseFile.objects.filter(
                    release_id=release.id, dist_id=dist.id if dist else dist, ident=archive_ident
                ).select_related("file")
                releasefile = qs[0]
        except IndexError:
            # This should not happen when there is an archive_ident in the manifest
            logger.error("sourcemaps.missing_archive", exc_info=sys.exc_info())
            # Cache as nonexistent:
            cache.set(cache_key, -1, 60)
            return None
        else:
            try:
                with sentry_sdk.start_span(op="fetch_release_archive_for_url.fetch_releasefile"):
                    if releasefile.file.size <= options.get("releasefile.cache-max-archive-size"):
                        getfile = lambda: ReleaseFile.cache.getfile(releasefile)
                    else:
                        # For very large ZIP archives, pulling the entire file into cache takes too long.
                        # Only the blobs required to extract the current artifact (central directory and the file entry itself)
                        # should be loaded in this case.
                        getfile = releasefile.file.getfile

                    file_ = fetch_retry_policy(getfile)
            except Exception:
                logger.error("sourcemaps.read_archive_failed", exc_info=sys.exc_info())

                return None

            # `cache.set` will only keep values up to a certain size,
            # so we should not read the entire file if it's too large for caching
            if CACHE_MAX_VALUE_SIZE is not None and file_.size > CACHE_MAX_VALUE_SIZE:
                return file_

            with sentry_sdk.start_span(op="fetch_release_archive_for_url.read_for_caching") as span:
                span.set_data("file_size", file_.size)
                contents = file_.read()
            with sentry_sdk.start_span(op="fetch_release_archive_for_url.write_to_cache") as span:
                span.set_data("file_size", len(contents))
                cache.set(cache_key, contents, 3600)

            file_.seek(0)

            return file_


def compress(fp: IO) -> Tuple[bytes, bytes]:
    """Alternative for compress_file when fp does not support chunks"""
    content = fp.read()
    return zlib.compress(content), content


def is_html_response(result):
    # Check if response is HTML by looking if the first non-whitespace character is an open tag ('<').
    # This cannot parse as valid JS/JSON.
    # NOTE: not relying on Content-Type header because apps often don't set this correctly
    # Discard leading whitespace (often found before doctype)
    body_start = result.body[:20].lstrip()

    if body_start[:1] == b"<":
        return True
    return False


def get_max_age(headers):
    cache_control = headers.get("cache-control")
    max_age = CACHE_CONTROL_MIN

    if cache_control:
        match = CACHE_CONTROL_RE.search(cache_control)
        if match:
            max_age = max(CACHE_CONTROL_MIN, int(match.group(1)))
    return min(max_age, CACHE_CONTROL_MAX)


def is_data_uri(url):
    return url[:BASE64_PREAMBLE_LENGTH] == BASE64_SOURCEMAP_PREAMBLE


def urlify_debug_id(debug_id, file_url=""):
    return f"debug-id://{debug_id}/{file_url}"


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


def get_function_for_token(frame, token, previous_frame=None):
    """
    Get function name for a given frame based on the token resolved by symbolic.
    It tries following paths in order:
    - return token function name if we have a usable value (filtered through `USELESS_FN_NAMES` list),
    - return mapped name of the caller (previous frame) token if it had,
    - return token function name, including filtered values if it mapped to anything in the first place,
    - return current frames function name as a fallback
    """

    frame_function_name = frame.get("function")
    token_function_name = token.function_name

    # Try to use the function name we got from sourcemap-cache, filtering useless names.
    if token_function_name not in USELESS_FN_NAMES:
        return token_function_name

    # If not found, ask the callsite (previous token) for function name if possible.
    if previous_frame is not None:
        last_token = previous_frame.data.get("token")
        if last_token is not None and last_token.name not in ("", None):
            return last_token.name

    # If there was no minified name at all, return even useless, filtered one from the original token.
    if not frame_function_name:
        return token_function_name

    # Otherwise fallback to the old, minified name.
    return frame_function_name


def fold_function_name(function_name):
    """
    Fold multiple consecutive occurences of the same property name into a single group, excluding the last component.

    foo | foo
    foo.foo | foo.foo
    foo.foo.foo | {foo#2}.foo
    bar.foo.foo | bar.foo.foo
    bar.foo.foo.foo | bar.{foo#2}.foo
    bar.foo.foo.onError | bar.{foo#2}.onError
    bar.bar.bar.foo.foo.onError | {bar#3}.{foo#2}.onError
    bar.foo.foo.bar.bar.onError | bar.{foo#2}.{bar#2}.onError
    """

    parts = function_name.split(".")

    if len(parts) == 1:
        return function_name

    tail = parts.pop()
    grouped = [list(g) for _, g in groupby(parts)]

    def format_groups(p):
        if len(p) == 1:
            return p[0]
        return f"\u007b{p[0]}#{len(p)}\u007d"

    return f'{".".join(map(format_groups, grouped))}.{tail}'


# Sentinel value used to represent the failure of loading an archive.
INVALID_ARCHIVE = type("INVALID_ARCHIVE", (), {})()

# Maximum number of artifacts that we can pull and open from the database. This upper bound serves as a way to protect
# the system from loading an arbitrarily big number of artifacts that might cause high memory and cpu usage.
MAX_ARTIFACTS_NUMBER = 5


class Fetcher:
    """
    Components responsible for fetching files either by url or debug_id that aims at hiding the complexity involved
    in file fetching.
    """

    def __init__(self, organization, project=None, release=None, dist=None, allow_scraping=True):
        self.organization = organization
        self.project = project
        self.release = release
        self.dist = dist
        self.allow_scraping = allow_scraping
        # Mappings between bundle_id -> ArtifactBundleArchive to keep all the open archives in memory.
        self.open_archives = {}
        # Set that contains all the urls for which the fetch_by_url failed at all levels (e.g., release bundle and
        # http).
        self.failed_urls = set()
        # Set that contains all the tuples (debug_id, source_file_type) for which the query returned an empty result.
        # Here we don't put the project in the set, under the assumption that the project will remain the same for the
        # whole lifecycle of the Fetcher.
        self.empty_result_for_debug_ids = set()
        # Set that contains all the tuples (release, dist) of a bundle for which the query returned an empty result.
        # Here we also don't put the project for the same reasoning as above.
        self.empty_result_for_releases = set()

    def bind_release(self, release=None, dist=None):
        """
        Updates the fetcher with a release and dist.
        """
        self.release = release
        self.dist = dist

    def close(self):
        """
        Closes all the open archives in cache.
        """
        for _, open_archive in self.open_archives.items():
            if open_archive is not INVALID_ARCHIVE:
                open_archive.close()

    def _lookup_in_open_archives(self, block):
        """
        Looks up in open archives if there is one that contains a matching file with debug_id and source_file_type.
        """
        for artifact_bundle_id, open_archive in self.open_archives.items():
            if open_archive is INVALID_ARCHIVE:
                continue

            try:
                block(open_archive)
                return open_archive
            except Exception as exc:
                logger.debug(
                    "Archive with id %s doesn't contain file",
                    artifact_bundle_id,
                    exc_info=exc,
                )
                continue

        return None

    def _get_artifact_bundle_entry_by_debug_id(self, debug_id, source_file_type):
        """
        Gets the DebugIdArtifactBundle entry that maps the debug_id and source_file_type to a specific ArtifactBundle.

        This query might return multiple entries, since a debug_id can point to multiple bundles. In this case we
        decided to take the first element from the result set, but we could use a stronger heuristic like taking the
        newest entry.
        """
        project_id = self.project.id if self.project else None

        if (debug_id, source_file_type) in self.empty_result_for_debug_ids:
            raise Exception(
                f"There are no artifact bundles bound to project {project_id}"
                f"that contain debug_id {debug_id} for source_file_type {source_file_type}"
            )

        entry = list(
            ArtifactBundle.objects.filter(
                organization_id=self.organization.id,
                debugidartifactbundle__debug_id=debug_id,
                debugidartifactbundle__source_file_type=source_file_type.value
                if source_file_type is not None
                else None,
                projectartifactbundle__project_id=project_id,
            )
            .order_by("-date_uploaded")
            .select_related("file")[:1]
        )

        # In case we didn't find any matching result, we will cache that this query had an empty result in order to
        # avoid making the query for subsequent frames.
        if len(entry) == 0:
            self.empty_result_for_debug_ids.add((debug_id, source_file_type))
            raise Exception(
                f"There are no artifact bundles bound to project {self.project.id}"
                f"that contain debug_id {debug_id} for source_file_type {source_file_type}"
            )

        return entry[0]

    @staticmethod
    def _fetch_artifact_bundle_file(artifact_bundle):
        """
        Fetches the File object bound to an ArtifactBundle.

        The File object represents the actual .zip bundle file which contains all the required artifacts.
        """
        # We try to load the bundle file from the cache. The file we are loading here is the entire bundle, not
        # the contents.
        #
        # We want to index the cache by the id of the ArtifactBundle in the db which is different from the bundle_id
        # UUID field.
        cache_key = get_artifact_bundle_cache_key(artifact_bundle.id)
        result = cache.get(cache_key)
        if result:
            return BytesIO(result)

        # We didn't find the bundle in the cache, thus we want to fetch it.
        artifact_bundle_file = fetch_retry_policy(artifact_bundle.file.getfile)

        # `cache.set` will only keep values up to a certain size,
        # so we should not read the entire file if it's too large for caching
        if CACHE_MAX_VALUE_SIZE is not None and artifact_bundle_file.size > CACHE_MAX_VALUE_SIZE:
            return artifact_bundle_file

        with sentry_sdk.start_span(op="_fetch_artifact_bundle_file.read_for_caching") as span:
            span.set_data("file_size", artifact_bundle_file.size)
            contents = artifact_bundle_file.read()
        with sentry_sdk.start_span(op="_fetch_artifact_bundle_file.write_to_cache") as span:
            span.set_data("file_size", len(contents))
            cache.set(cache_key, contents, 3600)

        artifact_bundle_file.seek(0)
        return artifact_bundle_file

    def _open_artifact_bundle_archive(self, debug_id, source_file_type):
        """
        Opens an ArtifactBundle as a .zip file and returns an ArtifactBundleArchive object that allows the caller
        to read index individual files within the archive.

        This function uses two levels of caching:
        1. self.open_archives is a local cache that persists for the Fetcher lifetime and contains all the opened
        archives indexed by artifact bundle id.
        2. self._fetch_artifact_bundle_file uses inside the default cache which is hosted on memcached and stores the
        actual File object bound to a specific ArtifactBundle. memcached is persisted across processor runs as opposed
        to the local cache.
        """
        artifact_bundle_id = None

        try:
            # In order to avoid making a multi-join query, we first look if the file is existing in an already cached
            # and opened archive.
            # We do this under the assumption that the number of open archives for a single event is not very big,
            # considering that most frames will be resolved with the data from within the same artifact bundle.
            with sentry_sdk.start_span(op="Fetcher.fetch_by_debug_id._lookup_in_open_archives"):
                cached_open_archive = self._lookup_in_open_archives(
                    lambda open_archive: open_archive.get_file_by_debug_id(
                        debug_id, source_file_type
                    )
                )
                if cached_open_archive:
                    return cached_open_archive

            # We want to run a query to determine the artifact bundle that contains the tuple
            # (debug_id, source_file_type).
            with sentry_sdk.start_span(
                op="Fetcher.fetch_by_debug_id._get_artifact_bundle_entry_by_debug_id"
            ):
                artifact_bundle = self._get_artifact_bundle_entry_by_debug_id(
                    debug_id, source_file_type
                )
                artifact_bundle_id = artifact_bundle.id

            # Given an artifact bundle id we check in the local cache if we have the archive already opened.
            cached_open_archive = self.open_archives.get(artifact_bundle_id)
            if cached_open_archive is not None:
                # In case we already tried to load an ArtifactBundle with this id, and we failed, we don't want
                # to try and fetch again the bundle.
                if cached_open_archive is INVALID_ARCHIVE:
                    return None

                return cached_open_archive

            # In case the local cache doesn't have the archive, we will try to load it from memcached and then directly
            # from the source.
            with sentry_sdk.start_span(op="Fetcher.fetch_by_debug_id._fetch_artifact_bundle_file"):
                artifact_bundle_file = self._fetch_artifact_bundle_file(artifact_bundle)
        except Exception as exc:
            logger.debug(
                "Failed to load the artifact bundle for debug_id %s and source_file_type %s",
                debug_id,
                source_file_type,
                exc_info=exc,
            )
            if artifact_bundle_id:
                self.open_archives[artifact_bundle_id] = INVALID_ARCHIVE

            return None
        else:
            archive = None

            try:
                # We load the entire bundle into an archive and cache it locally. It is very important that this opened
                # archive is closed before the processing ends.
                with sentry_sdk.start_span(op="Fetcher.fetch_by_debug_id.ArtifactBundleArchive"):
                    archive = ArtifactBundleArchive(artifact_bundle_file)
                    self.open_archives[artifact_bundle_id] = archive
            except Exception as exc:
                artifact_bundle_file.seek(0)
                logger.debug(
                    "Failed to initialize archive for the artifact bundle file",
                    exc_info=exc,
                    extra={"contents": base64.b64encode(artifact_bundle_file.read(256))},
                )
                if artifact_bundle_id:
                    self.open_archives[artifact_bundle_id] = INVALID_ARCHIVE

            return archive

    def fetch_by_debug_id(self, debug_id, source_file_type):
        """
        Pulls down the file indexed by debug_id and source_file_type from an ArtifactBundle and returns a UrlResult
        object that "falsely" emulates an HTTP response connected to an HTTP request for fetching the file.
        """
        with sentry_sdk.start_span(op="Fetcher.fetch_by_debug_id._open_artifact_bundle_archive"):
            # We first try to open the entire .zip artifact bundle given the debug_id and the source_file_type.
            archive = self._open_artifact_bundle_archive(debug_id, source_file_type)
            if archive is None:
                return None

        try:
            # In this case we bail if we didn't find a find the file in the latest uploaded bundle, but technically we
            # could implement a best effort mechanism that works similarly to fetch_by_url_new, in which we open all
            # n bundles containing a debug_id and look for a specific file type.
            fp, headers = archive.get_file_by_debug_id(debug_id, source_file_type)
        except Exception as exc:
            logger.debug(
                "File with debug id %s and source type %s not found in artifact bundle",
                debug_id,
                source_file_type,
                exc_info=exc,
            )

            result = None
        else:
            # We decided to reuse the existing function but without caching in order to reuse some logic but in reality
            # the code could be inlined and simplified.
            result = fetch_and_cache_artifact(
                urlify_debug_id(
                    debug_id, archive.get_file_url_by_debug_id(debug_id, source_file_type)
                ),
                lambda: fp,
                None,
                None,
                headers,
                compress_fn=compress,
            )

        return result

    def _get_artifact_bundle_entries_by_release_dist_pair(self):
        """
        Gets the MAX_ARTIFACT_NUMBER most recent entries in the ReleaseArtifactBundle table together with the respective
        ArtifactBundle and the connected File.
        """
        # In case we don't have a release set, we don't even want to try and run the query because we won't be able
        # to look for the bundle we want.
        if self.release is None:
            return []

        project_id = self.project.id if self.project else None

        if (self.release, self.dist) in self.empty_result_for_releases:
            raise Exception(
                f"There are no artifact bundles bound to project {project_id}"
                f"for release {self.release} and dist {self.dist}"
            )

        entries = list(
            ArtifactBundle.objects.filter(
                organization_id=self.organization.id,
                releaseartifactbundle__release_name=self.release.version,
                releaseartifactbundle__dist_name=self.dist.name if self.dist else NULL_STRING,
                projectartifactbundle__project_id=project_id,
            )
            .order_by("-date_uploaded")
            .select_related("file")[: MAX_ARTIFACTS_NUMBER + 1]
        )

        # In case we didn't find any matching result, we will cache that this query had an empty result in order to
        # avoid making the query for subsequent frames.
        if len(entries) == 0:
            self.empty_result_for_releases.add((self.release, self.dist))
            raise Exception(
                f"There are no artifact bundles bound to project {project_id}"
                f"for release {self.release} and dist {self.dist}"
            )

        # We want to log if the user has more artifacts than the current max.
        if len(entries) > MAX_ARTIFACTS_NUMBER:
            logger.debug(
                f"The number of artifact bundles for the release {self.release.version}"
                f"is more than the default {MAX_ARTIFACTS_NUMBER}."
            )

        return entries[:MAX_ARTIFACTS_NUMBER]

    def _open_archive_by_url(self, url):
        """
        Opens all the archives connected to the release/dist pair and returns the first one containing a file with
        the supplied "url".

        The idea of opening all connected archives is because we upper bound them, and we know that for most frames,
        they will be resolved by files within the same archive.
        """
        artifact_bundle_files = []
        failed_artifact_bundle_ids = set()

        def file_by_url_candidates_lookup(open_archive):
            try_get_with_normalized_urls(
                url, lambda candidate: open_archive.get_file_by_url(candidate)
            )

        try:
            # We want to first lookup in all existing open archives, just to save us an expensive query.
            with sentry_sdk.start_span(op="Fetcher.fetch_by_url_new._pre_lookup_in_open_archives"):
                cached_open_archive = self._lookup_in_open_archives(file_by_url_candidates_lookup)
                if cached_open_archive:
                    return cached_open_archive

            with sentry_sdk.start_span(
                op="Fetcher.fetch_by_url_new._get_artifact_bundle_entries_by_release_dist_pair"
            ):
                artifact_bundles = self._get_artifact_bundle_entries_by_release_dist_pair()

            for artifact_bundle in artifact_bundles:
                cached_open_archive = self.open_archives.get(artifact_bundle.id)

                # In case the archive is marked as INVALID_ARCHIVE we are just going to continue in the hope of
                # finding other cached archives.
                if cached_open_archive is INVALID_ARCHIVE:
                    continue

                # Only if we find a valid open archive we return the archive itself.
                if cached_open_archive is not None:
                    return cached_open_archive

                try:
                    # In case we didn't find the archive in the cache, we want to fetch the artifact bundle to put later
                    # in the cache.
                    with sentry_sdk.start_span(
                        op="Fetcher.fetch_by_url_new._fetch_artifact_bundle_file"
                    ):
                        artifact_bundle_file = self._fetch_artifact_bundle_file(artifact_bundle)
                        artifact_bundle_files.append((artifact_bundle.id, artifact_bundle_file))
                except Exception as exc:
                    logger.debug(
                        "Failed to fetch artifact bundle %s", artifact_bundle.id, exc_info=exc
                    )
                    failed_artifact_bundle_ids.add(artifact_bundle.id)

            # In case during the loading we ended up not being able to load anything and we got at least one error, we
            # can't do much.
            if len(artifact_bundle_files) == 0 and len(failed_artifact_bundle_ids) > 0:
                raise Exception(
                    "Failed to fetch at least one artifact bundle given a release/dist pair"
                )
        except Exception as exc:
            logger.debug(
                "Failed to load the artifact bundles for release %s and dist %s",
                self.release,
                self.dist,
                exc_info=exc,
            )
            # In case we got an exception we want to mark all the ids that we failed to fetch as invalid. In case
            # an exception is thrown before fetching any bundles, the set will be empty, thus no bundles will be marked
            # as invalid.
            for failed_artifact_bundle_id in failed_artifact_bundle_ids:
                self.open_archives[failed_artifact_bundle_id] = INVALID_ARCHIVE

            return None
        else:
            for artifact_bundle_id, artifact_bundle_file in artifact_bundle_files:
                try:
                    with sentry_sdk.start_span(op="Fetcher.fetch_by_url_new.ArtifactBundleArchive"):
                        archive = ArtifactBundleArchive(artifact_bundle_file)
                        self.open_archives[artifact_bundle_id] = archive
                except Exception as exc:
                    artifact_bundle_file.seek(0)
                    logger.debug(
                        "Failed to initialize archive for the artifact bundle file",
                        exc_info=exc,
                        extra={"contents": base64.b64encode(artifact_bundle_file.read(256))},
                    )
                    if artifact_bundle_id:
                        self.open_archives[artifact_bundle_id] = INVALID_ARCHIVE

            # After having loaded all the archives into memory, we want to look if we have the file again. Technically
            # we could recursively implement this behavior but that would require the usage of a discriminator variable
            # that will immediately return if the lookup is not successful. The repetition of the lookup seems a more
            # explicit way to do the work.
            with sentry_sdk.start_span(op="Fetcher.fetch_by_url_new._post_lookup_in_open_archives"):
                cached_open_archive = self._lookup_in_open_archives(file_by_url_candidates_lookup)
                if cached_open_archive:
                    return cached_open_archive

            return None

    def fetch_by_url_new(self, url):
        """
        Pulls down the file indexed by url using the data in the ReleaseArtifactBundle table and returns a UrlResult
        object that "falsely" emulates an HTTP response connected to an HTTP request for fetching the file.
        """
        if self.release is None:
            return None

        cache_key, cache_key_meta = get_cache_keys_new(url, self.release, self.dist)
        result = cache.get(cache_key)
        if result == -1:  # Cached as unavailable
            return None
        if result:
            return result_from_cache(url, result)

        # We want to first look for the file by url in the new tables ReleaseArtifactBundle and ArtifactBundle.
        with sentry_sdk.start_span(op="Fetcher.fetch_by_url_new._open_archive_by_url"):
            archive = self._open_archive_by_url(url)
            if archive is not None:
                try:
                    # We know that if we have an archive which is not None, that the url will be found internally but
                    # we still cover with an exception handler the whole code to make sure all possible failures are
                    # caught.
                    #
                    # Technically we could return the matched candidate url from _open_archive_by_url() but considering
                    # that try_get_with_normalized_urls() is O(1) the benefits will not outweigh the clean code.
                    fp, headers = try_get_with_normalized_urls(
                        url, lambda candidate: archive.get_file_by_url(candidate)
                    )
                    result = fetch_and_cache_artifact(
                        url,
                        lambda: fp,
                        cache_key,
                        cache_key_meta,
                        headers,
                        compress_fn=compress,
                    )
                except Exception as exc:
                    cache.set(cache_key, -1, 60)
                    logger.debug(
                        "Failed to open file with base url %s in artifact bundle", url, exc_info=exc
                    )

        return result

    def _fetch_release_artifact(self, url):
        """
        Get a release artifact either by extracting it or fetching it directly.

        If a release archive was saved, the individual file will be extracted
        from the archive.
        """
        # If we weren't able to load the file by release in the new tables, we want to fallback to the old mechanism.
        cache_key, cache_key_meta = get_cache_keys(url, self.release, self.dist)
        result = cache.get(cache_key)
        if result == -1:  # Cached as unavailable
            return None
        if result:
            return result_from_cache(url, result)

        start = time.monotonic()
        with sentry_sdk.start_span(
            op="Fetcher._fetch_release_artifact.fetch_release_archive_for_url"
        ):
            archive_file = fetch_release_archive_for_url(self.release, self.dist, url)
        if archive_file is not None:
            try:
                archive = ReleaseArchive(archive_file)
            except Exception as exc:
                archive_file.seek(0)
                logger.error(
                    "Failed to initialize archive for release %s",
                    self.release.id,
                    exc_info=exc,
                    extra={"contents": base64.b64encode(archive_file.read(256))},
                )
                # TODO(jjbayer): cache error and return here
            else:
                with archive:
                    try:
                        fp, headers = try_get_with_normalized_urls(
                            url, lambda candidate: archive.get_file_by_url(candidate)
                        )
                    except KeyError:
                        # The manifest mapped the url to an archive, but the file
                        # is not there.
                        logger.error(
                            "Release artifact %r not found in archive %s", url, archive_file.id
                        )
                        cache.set(cache_key, -1, 60)
                        metrics.timing(
                            "sourcemaps.release_artifact_from_archive", time.monotonic() - start
                        )
                        return None
                    except Exception as exc:
                        logger.error(
                            "Failed to read %s from release %s", url, self.release.id, exc_info=exc
                        )
                        # TODO(jjbayer): cache error and return here
                    else:
                        result = fetch_and_cache_artifact(
                            url,
                            lambda: fp,
                            cache_key,
                            cache_key_meta,
                            headers,
                            # Cannot use `compress_file` because `ZipExtFile` does not support chunks
                            compress_fn=compress,
                        )
                        metrics.timing(
                            "sourcemaps.release_artifact_from_archive", time.monotonic() - start
                        )

                        return result

        # Fall back to maintain compatibility with old releases and versions of
        # sentry-cli which upload files individually
        with sentry_sdk.start_span(op="Fetcher._fetch_release_artifact.fetch_release_file"):
            result = fetch_release_file(url, self.release, self.dist)

        return result

    def fetch_by_url(self, url):
        """
        Pull down a URL, returning a UrlResult object.

        Attempts to fetch from the database first (assuming there's a release on the
        event), then the internet. Caches the result of each of those two attempts
        separately, whether those attempts are successful. Used for both
        source files and source maps.
        """
        # In case we know that this url has resulted in a failure while processing previous frame, we want to fail
        # early in order to avoid wasting resources. This is done under the assumption that a failed url can't become
        # successful after an arbitrary amount of time, in which case it would be sensible to properly retry.
        if url in self.failed_urls:
            return None

        # If our url has been truncated, it'd be impossible to fetch
        # so we check for this early and bail
        if url[-3:] == "...":
            raise http.CannotFetch(
                {"type": EventError.JS_MISSING_SOURCE, "url": http.expose_url(url)}
            )

        # if we've got a release to look on, try that first (incl associated cache)
        if self.release:
            with sentry_sdk.start_span(op="Fetcher.fetch_by_url.fetch_release_artifact"):
                result = self._fetch_release_artifact(url)
        else:
            result = None

        # otherwise, try the web-scraping cache and then the web itself

        cache_key = f"source:cache:v4:{md5_text(url).hexdigest()}"

        if result is None:
            if not url.startswith(("http:", "https:")):
                error = {"type": EventError.JS_MISSING_SOURCE, "url": http.expose_url(url)}
                self.failed_urls.add(url)
                raise http.CannotFetch(error)

            if not self.allow_scraping:
                error = {"type": EventError.JS_SCRAPING_DISABLED, "url": http.expose_url(url)}
                self.failed_urls.add(url)
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
            if self.project and is_valid_origin(url, project=self.project):
                verify_ssl = bool(self.project.get_option("sentry:verify_ssl", False))
                token = self.project.get_option("sentry:token")
                if token:
                    token_header = (
                        self.project.get_option("sentry:token_header") or "X-Sentry-Token"
                    )
                    headers[token_header] = token

            with metrics.timer("sourcemaps.fetch"):
                with sentry_sdk.start_span(op="JavaScriptStacktraceProcessor.fetch_file.http"):
                    result = http.fetch_file(url, headers=headers, verify_ssl=verify_ssl)
                with sentry_sdk.start_span(op="Fetcher.fetch_by_url.compress_for_cache"):
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
                    self.failed_urls.add(url)
                    raise http.CannotFetch(error)

        # If we did not get a 200 OK we just raise a cannot fetch here.
        if result.status != 200:
            self.failed_urls.add(url)
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
                self.failed_urls.add(url)
                raise http.CannotFetch(error)

        # For JavaScript files, check if content is something other than JavaScript/JSON (i.e. HTML)
        # NOTE: possible to have JS files that don't actually end w/ ".js", but
        # this should catch 99% of cases
        if urlsplit(url).path.endswith(".js") and is_html_response(result):
            error = {"type": EventError.JS_INVALID_CONTENT, "url": url}
            self.failed_urls.add(url)
            raise http.CannotFetch(error)

        # If result is None it means that all of our lookups failed, we want to mark this failure in order to avoid
        # making the requests over and over for each frame.
        if result is None:
            self.failed_urls.add(url)

        return result


class FetcherSource(Enum):
    """
    Source of the data returned from the fetcher.

    We use this enumerator to determine the source from which the Fetcher fetched the data. This can't be inferred
    directly from the result of the function call because we always return the same UrlObject irrespectively of the
    data source. The need for the fetching source is because we want to change our processing behavior based on the
    source from which the data has been fetched (e.g., if we fetched through debug_id, we need to enforce the
    'sourcesContent' in the sourcemap).
    """

    NONE = 0
    URL = 1
    URL_NEW = 2
    DEBUG_ID = 3


class JavaScriptStacktraceProcessor(StacktraceProcessor):
    """
    Modern SourceMap processor using symbolic-sourcemapcache.
    Attempts to fetch source code for javascript frames,
    and map their minified positions to original location.

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

        self.organization = organization
        self.max_fetches = MAX_RESOURCE_FETCHES

        self.fetch_count = 0
        self.sourcemaps_touched = set()

        # All the following dictionaries have been defined top level for simplicity reasons. Because this code will
        # be ported to Symbolicator we wanted to keep it as simple and explicit as possible. This comment also
        # applies to the many repetitions across the code.

        # Cache the corresponding debug id for a specific abs path.
        self.abs_path_debug_id = {}

        # Cache holding the results of the fetching by url.
        self.fetch_by_url_sourceviews = {}
        self.fetch_by_url_errors = {}

        # Cache holding the results of the new fetching by url that uses the ReleaseArtifactBundle and ArtifactBundle
        # tables.
        self.fetch_by_url_new_sourceviews = {}
        self.fetch_by_url_new_errors = {}

        # Cache holding the results of the fetching by debug id.
        self.fetch_by_debug_id_sourceviews = {}
        self.fetch_by_debug_id_errors = {}

        # Cache holding the sourcemap caches indexed by either debug id, sourcemap url new or sourcemap url.
        self.debug_id_sourcemap_cache = {}
        self.sourcemap_url_new_sourcemap_cache = {}
        self.sourcemap_url_sourcemap_cache = {}

        # Contains a mapping between the minified source url ('abs_path' of the frame) and the sourcemap url
        # which is discovered by looking at the minified source.
        self.minified_source_url_to_sourcemap_url = {}
        # Contains a mapping between the debug id and the sourcemap url resolved with that debug id.
        self.sourcemap_debug_id_to_sourcemap_url = {}

        # Component responsible for fetching the files.
        self.fetcher = Fetcher(
            organization=self.organization,
            project=self.project,
            allow_scraping=organization.get_option("sentry:scrape_javascript", True) is not False
            and self.project.get_option("sentry:scrape_javascript", True),
        )

    def get_valid_frames(self):
        # build list of frames that we can actually grab source for
        frames = []
        for info in self.stacktrace_infos:
            frames.extend(get_path(info.stacktrace, "frames", filter=is_valid_frame, default=()))
        return frames

    def build_abs_path_debug_id_cache(self):
        images = get_path(self.data, "debug_meta", "images", filter=True, default=())

        for image in images:
            code_file = image.get("code_file", None)
            debug_id = image.get("debug_id", None)

            if code_file is not None and debug_id is not None:
                self.abs_path_debug_id[code_file] = debug_id

    def preprocess_step(self, processing_task):
        frames = self.get_valid_frames()
        if not frames:
            logger.debug(
                "Event %r has no frames with enough context to " "fetch remote source",
                self.data["event_id"],
            )
            return False

        with sentry_sdk.start_span(op="JavaScriptStacktraceProcessor.preprocess_step.get_release"):
            release = self.get_release(create=True)
            dist = None

            if self.data.get("dist") and release:
                timestamp = self.data.get("timestamp")
                date = timestamp and datetime.fromtimestamp(timestamp).replace(tzinfo=timezone.utc)
                dist = release.add_dist(self.data["dist"], date)

        self.fetcher.bind_release(release=release, dist=dist)

        with sentry_sdk.start_span(
            op="JavaScriptStacktraceProcessor.preprocess_step.build_abs_path_to_debug_id_cache"
        ):
            self.build_abs_path_debug_id_cache()

        with sentry_sdk.start_span(
            op="JavaScriptStacktraceProcessor.preprocess_step.populate_source_cache"
        ):
            self.populate_source_cache(frames)

        return True

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get("platform") or self.data.get("platform")
        return platform in ("javascript", "node")

    def preprocess_frame(self, processable_frame):
        # Stores the resolved token.  This is used to cross refer to other
        # frames for function name resolution by call site.
        processable_frame.data = {"token": None}

    def process_frame(self, processable_frame, processing_task):
        """
        Attempt to demangle the given frame.
        """
        frame = processable_frame.frame

        all_errors = []
        sourcemap_applied = False

        # can't demangle if there's no filename or line number present
        if not frame.get("abs_path") or not frame.get("lineno"):
            return

        # also can't demangle node's internal modules
        # therefore we only process user-land frames (starting with /)
        # or those created by bundle/webpack internals
        if self.data.get("platform") == "node" and not frame["abs_path"].startswith(
            ("/", "app:", "webpack:")
        ):
            return

        # We get the debug_id for file in this frame, if any.
        debug_id = self.abs_path_debug_id.get(frame["abs_path"])

        # The 'sourceview' is used for pre/post and 'context_line' frame expansion.
        # Here it's pointing to the minified source, however the variable can be shadowed with the original sourceview
        # (or 'None' if the token doesn't provide us with the 'context_line') down the road.
        sourceview, resolved_sv_with = self.get_or_fetch_sourceview(
            url=frame["abs_path"],
            debug_id=debug_id,
            source_file_type=SourceFileType.MINIFIED_SOURCE,
        )
        # Only if we resolved the minified source with a debug_id we want to try and resolve the sourcemap with the
        # debug_id.
        sourcemap_cache, resolved_smc_with = self.get_or_fetch_sourcemap_cache(
            url=frame["abs_path"],
            debug_id=debug_id if resolved_sv_with == FetcherSource.DEBUG_ID else None,
        )

        # We check for errors once both the minified file and the corresponding sourcemaps are loaded. In case errors
        # happen in one of the three we will detect them and add them to 'all_errors'.
        url_errors = self.fetch_by_url_errors.get(frame["abs_path"])
        if url_errors is not None:
            all_errors.extend(url_errors)

        url_new_errors = self.fetch_by_url_new_errors.get(frame["abs_path"])
        if url_new_errors:
            all_errors.extend(url_new_errors)

        debug_id_errors = self.fetch_by_debug_id_errors.get(debug_id)
        if debug_id_errors is not None:
            all_errors.extend(debug_id_errors)

        # We want to compute the sourcemap url for logging purposes based on which resolution source we used.
        if resolved_smc_with == FetcherSource.DEBUG_ID:
            sourcemap_url = self.sourcemap_debug_id_to_sourcemap_url.get(debug_id)
        else:
            sourcemap_url = self.minified_source_url_to_sourcemap_url.get(frame["abs_path"])
        # We keep track of how many sourcemaps we touched.
        self.sourcemaps_touched.add(sourcemap_url)

        source_context = None

        in_app = None
        new_frame = dict(frame)
        raw_frame = dict(frame)

        if sourcemap_cache and frame.get("colno") is None:
            all_errors.append(
                {"type": EventError.JS_NO_COLUMN, "url": http.expose_url(frame["abs_path"])}
            )
        elif sourcemap_cache:
            if is_data_uri(sourcemap_url):
                sourcemap_label = frame["abs_path"]
            else:
                sourcemap_label = sourcemap_url

            sourcemap_label = http.expose_url(sourcemap_label)

            try:
                # Errors are 1-indexed in the frames.
                assert frame["lineno"] > 0, "line numbers are 1-indexed"
                token = sourcemap_cache.lookup(frame["lineno"], frame["colno"], LINES_OF_CONTEXT)
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
                if token.src is not None:
                    abs_path = non_standard_url_join(sourcemap_url, token.src)
                else:
                    abs_path = frame["abs_path"]

                logger.debug(
                    "Mapping compressed source %r to mapping in %r", frame["abs_path"], abs_path
                )

                # Source context and sourceview will be both used down the line during frame expansion.
                if token.context_line is not None:
                    # If we arrive here, it means that we found the original source in the source map, thus we can
                    # obtain source context directly from there.
                    source_context = token.pre_context, token.context_line, token.post_context
                else:
                    # We require "sourcesContent" to be present in case we fetched the sourcemap via either
                    # fetch_by_debug_id() or fetch_by_url_new().
                    if resolved_smc_with in {FetcherSource.DEBUG_ID, FetcherSource.URL_NEW}:
                        all_errors.append(
                            {
                                "type": EventError.JS_MISSING_SOURCES_CONTENT,
                                "source": frame["abs_path"],
                                "sourcemap": sourcemap_label,
                            }
                        )
                    else:
                        # If we arrive here, it means that we want to load the actual source file because it was missing
                        # inside the sourcemap. Because we don't allow the absence of source contents in the sourcemaps
                        # containing a debug_id, we will only fetch by url.
                        sourceview, _ = self.get_or_fetch_sourceview(url=abs_path)

                # In case we are not able to load the original source, we can't do much besides logging it.
                if sourceview is None:
                    errors = self.fetch_by_url_errors.get(abs_path)
                    if errors:
                        all_errors.extend(errors)
                    else:
                        all_errors.append(
                            {"type": EventError.JS_MISSING_SOURCE, "url": http.expose_url(abs_path)}
                        )

                # The tokens are 1-indexed.
                new_frame["lineno"] = token.line
                new_frame["colno"] = token.col
                new_frame["function"] = fold_function_name(
                    get_function_for_token(new_frame, token, processable_frame.previous_frame)
                )

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
                    elif WEBPACK_NAMESPACE_RE.match(filename):
                        filename = re.sub(WEBPACK_NAMESPACE_RE, "./", abs_path)
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

        # This expansion is done on the new symbolicated frame. Here we are passing the context lines that are fetched
        # from the sourcemap or the original source from which we are going to extract context ourselves.
        changed_frame = self.expand_frame(
            new_frame, debug_id, source_context=source_context, source=sourceview
        )

        # If we did not manage to match but we do have a line or column
        # we want to report an error here.
        if not new_frame.get("context_line") and sourceview and new_frame.get("colno") is not None:
            all_errors.append(
                {
                    "type": EventError.JS_INVALID_SOURCEMAP_LOCATION,
                    "column": new_frame["colno"],
                    "row": new_frame["lineno"],
                    "source": new_frame["abs_path"],
                }
            )

        # This second call to the frame expansion is done on the raw frame, thus we are just naively going to obtain
        # context in the original file from which the error has been thrown.
        changed_raw = sourcemap_applied and self.expand_frame(raw_frame, debug_id)

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

            try:
                if features.has(
                    "organizations:javascript-console-error-tag", self.organization, actor=None
                ):
                    self.tag_suspected_console_errors(new_frames)
            except Exception as exc:
                logger.exception("Failed to tag suspected console errors", exc_info=exc)

            return new_frames, raw_frames, all_errors

    def tag_suspected_console_errors(self, new_frames):
        def tag_error(new_frames):
            suspected_console_errors = None
            try:
                suspected_console_errors = self.suspected_console_errors(new_frames)
            except Exception as exc:
                logger.error(
                    "Failed to evaluate event for suspected JavaScript browser console error",
                    exc_info=exc,
                )

            try:
                set_tag(self.data, "empty_stacktrace.js_console", suspected_console_errors)
            except Exception as exc:
                logger.error(
                    "Failed to tag event with empty_stacktrace.js_console=%s for suspected JavaScript browser console error",
                    suspected_console_errors,
                    exc_info=exc,
                )

        try:
            if features.has(
                "organizations:javascript-console-error-tag", self.organization, actor=None
            ):
                tag_error(new_frames)
        except Exception as exc:
            logger.exception("Failed to tag suspected console errors", exc_info=exc)

    def expand_frame(self, frame, debug_id, source_context=None, source=None):
        """
        Mutate the given frame to include pre- and post-context lines.
        """

        if frame.get("lineno") is None:
            return False

        if source_context is None:
            # For the new_frame expansion if we have a debug_id and the source_context is None it means that
            # 'sourcesContent' was not found in the sourcemap, thus we want to resolve the context by just looking at
            # the minified file itself. If the minified file is not found by debug_id, we will look up by url but
            # that shouldn't happen because if we can't find the minified file tied to this debug_id it means that
            # the injection + upload of debug ids failed.
            #
            # For the raw_frame expansion we want to just load the file tied to the frame and if the frame has a
            # debug_id the file must be a minified file, otherwise we can load either the minified or the original
            # source via the url.
            source = (
                source
                or self.get_or_fetch_sourceview(
                    url=frame["abs_path"],
                    debug_id=debug_id,
                    source_file_type=SourceFileType.MINIFIED_SOURCE,
                )[0]
            )
            if source is None:
                logger.debug("No source found for %s", frame["abs_path"])
                return False

        (pre_context, context_line, post_context) = source_context or get_source_context(
            source=source, lineno=frame["lineno"]
        )

        if pre_context is not None and len(pre_context) > 0:
            frame["pre_context"] = [trim_line(x) for x in pre_context]
        if context_line is not None:
            frame["context_line"] = trim_line(context_line, frame.get("colno") or 0)
        if post_context is not None and len(post_context) > 0:
            frame["post_context"] = [trim_line(x) for x in post_context]

        return True

    def get_or_fetch_sourceview(self, url=None, debug_id=None, source_file_type=None):
        """
        Gets from the cache or fetches the file at 'url' or 'debug_id'.

        Returns None when a file with either 'url' or 'debug_id' cannot be found.
        """
        # We require that artifact bundles with debug ids used embedded source in the source map. For this reason
        # it is not possible to look for a source file with a debug id.
        if debug_id is not None and source_file_type == SourceFileType.SOURCE:
            return None

        sourceview, resolved_with = self._get_cached_sourceview(url, debug_id, source_file_type)
        if sourceview is not None:
            return sourceview, resolved_with

        return self._fetch_and_cache_sourceview(url, debug_id, source_file_type)

    def _get_cached_sourceview(self, url=None, debug_id=None, source_file_type=None):
        if debug_id is not None:
            sourceview = self.fetch_by_debug_id_sourceviews.get((debug_id, source_file_type))
            if sourceview is not None:
                return sourceview, FetcherSource.DEBUG_ID

        if url is not None:
            sourceview = self.fetch_by_url_new_sourceviews.get(url)
            if sourceview is not None:
                return sourceview, FetcherSource.URL_NEW

            sourceview = self.fetch_by_url_sourceviews.get(url)
            if sourceview is not None:
                return sourceview, FetcherSource.URL

        return None, FetcherSource.NONE

    def _fetch_and_cache_sourceview(self, url, debug_id, source_file_type):
        self.fetch_count += 1

        if self.fetch_count > self.max_fetches:
            self.fetch_by_url_errors.setdefault(url, []).append(
                {"type": EventError.JS_TOO_MANY_REMOTE_SOURCES}
            )
            return None, FetcherSource.NONE

        if debug_id is not None:
            logger.debug("Attempting to cache source with debug id %r", debug_id)
            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.fetch_and_cache_sourceview.fetch_by_debug_id"
            ) as span:
                span.set_data("debug_id", debug_id)
                result = self.fetcher.fetch_by_debug_id(debug_id, source_file_type)
                if result is not None:
                    sourceview = SourceView.from_bytes(result.body)
                    self.fetch_by_debug_id_sourceviews[debug_id, source_file_type] = sourceview
                    return sourceview, FetcherSource.DEBUG_ID

        logger.debug("Attempting to cache source with url new %r", debug_id)
        with sentry_sdk.start_span(
            op="JavaScriptStacktraceProcessor.fetch_and_cache_sourceview.fetch_by_url_new"
        ) as span:
            span.set_data("url", url)
            result = self.fetcher.fetch_by_url_new(url)
            if result is not None:
                sourceview = SourceView.from_bytes(result.body)
                self.fetch_by_url_new_sourceviews[url] = sourceview

                sourcemap_url = discover_sourcemap(result)
                if sourcemap_url:
                    self.minified_source_url_to_sourcemap_url[url] = sourcemap_url

                return sourceview, FetcherSource.URL_NEW

        try:
            logger.debug("Attempting to cache source with url %r", url)
            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.fetch_and_cache_sourceview.fetch_by_url"
            ) as span:
                span.set_data("url", url)
                result = self.fetcher.fetch_by_url(url)
        except http.BadSource as exc:
            if not fetch_error_should_be_silienced(exc.data, url):
                self.fetch_by_url_errors.setdefault(url, []).append(exc.data)
            # either way, there's no more for us to do here, since we don't have
            # a valid file to cache
            return None, FetcherSource.NONE
        else:
            # In case the fetch_by_url call returns None, it means we weren't able to fetch the data or that the
            # request failed in the past, and we shouldn't retry it.
            if result is None:
                return None, FetcherSource.NONE

            sourceview = SourceView.from_bytes(result.body)
            self.fetch_by_url_sourceviews[url] = sourceview

            sourcemap_url = discover_sourcemap(result)
            if sourcemap_url:
                self.minified_source_url_to_sourcemap_url[url] = sourcemap_url

            return sourceview, FetcherSource.URL

    def get_or_fetch_sourcemap_cache(self, url=None, debug_id=None):
        """
        Gets from the cache or fetches the SmCache of the file at 'url' or 'debug_id'.

        Returns None when a sourcemap corresponding to the file at 'url' is not found.
        """
        sourcemap_cache, resolved_with = self._get_cached_sourcemap_cache(url, debug_id)
        if sourcemap_cache is not None:
            return sourcemap_cache, resolved_with

        return self._fetch_and_cache_sourcemap_cache(url, debug_id)

    def _get_cached_sourcemap_cache(self, url, debug_id):
        if debug_id is not None:
            sourcemap_cache = self.debug_id_sourcemap_cache.get(debug_id)
            if sourcemap_cache is not None:
                return sourcemap_cache, FetcherSource.DEBUG_ID

        if url is not None:
            # We get the url of the sourcemap from the url of the minified file.
            sourcemap_url = self.minified_source_url_to_sourcemap_url.get(url)

            sourcemap_cache = self.sourcemap_url_new_sourcemap_cache.get(sourcemap_url)
            if sourcemap_cache is not None:
                return sourcemap_cache, FetcherSource.URL_NEW

            sourcemap_cache = self.sourcemap_url_sourcemap_cache.get(sourcemap_url)
            if sourcemap_cache is not None:
                return sourcemap_cache, FetcherSource.URL

        return None, FetcherSource.NONE

    def _fetch_and_cache_sourcemap_cache(self, url, debug_id):
        if debug_id is not None:
            sourcemap_cache = self._handle_debug_id_sourcemap_lookup(debug_id)
            if sourcemap_cache is not None:
                return sourcemap_cache, FetcherSource.DEBUG_ID

        if url is not None:
            sourcemap_cache = self._handle_url_sourcemap_lookup(url, use_url_new=True)
            if sourcemap_cache is not None:
                return sourcemap_cache, FetcherSource.URL_NEW

            sourcemap_cache = self._handle_url_sourcemap_lookup(url, use_url_new=False)
            if sourcemap_cache is not None:
                return sourcemap_cache, FetcherSource.URL

        return None, FetcherSource.NONE

    def _handle_debug_id_sourcemap_lookup(self, debug_id):
        minified_sourceview = self.fetch_by_debug_id_sourceviews.get(
            (debug_id, SourceFileType.MINIFIED_SOURCE)
        )
        if minified_sourceview is None:
            return None

        try:
            sourcemap_cache = self._fetch_sourcemap_cache_by_debug_id(debug_id, minified_sourceview)
        except http.BadSource as exc:
            # We also keep track of errors raised during debug_id lookup.
            self.fetch_by_debug_id_errors.setdefault(debug_id, []).append(exc.data)
            return None
        else:
            self.debug_id_sourcemap_cache[debug_id] = sourcemap_cache
            return sourcemap_cache

    def _fetch_sourcemap_cache_by_debug_id(self, debug_id, minified_sourceview):
        result = self.fetcher.fetch_by_debug_id(debug_id, SourceFileType.SOURCE_MAP)
        if result is not None:
            try:
                with sentry_sdk.start_span(
                    op="JavaScriptStacktraceProcessor.fetch_sourcemap_view_by_debug_id.SmCache.from_bytes"
                ):
                    # We want to keep track of the sourcemap url of the sourcemap resolved with this specific debug id.
                    self.sourcemap_debug_id_to_sourcemap_url[debug_id] = result.url
                    # This is an expensive operation that should be executed as few times as possible.
                    return SmCache.from_bytes(
                        minified_sourceview.get_source().encode("utf-8"), result.body
                    )
            except Exception as exc:
                # This is in debug because the product shows an error already.
                logger.debug(str(exc), exc_info=True)
                raise UnparseableSourcemap({"debug_id": result.url})

        return None

    def _handle_url_sourcemap_lookup(self, url, use_url_new=False):
        # In case there are any fetching errors tied to the url of the minified file, we don't want to attempt the
        # construction of the sourcemap cache.
        errors = self.fetch_by_url_new_errors if use_url_new else self.fetch_by_url_errors
        if url in errors:
            return None

        minified_sourceview = (
            self.fetch_by_url_new_sourceviews.get(url)
            if use_url_new
            else self.fetch_by_url_sourceviews.get(url)
        )
        if minified_sourceview is None:
            return None

        sourcemap_url = self.minified_source_url_to_sourcemap_url.get(url)
        if sourcemap_url is None:
            return None

        try:
            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.handle_url_sourcemap_lookup.fetch_sourcemap_view_by_url"
            ) as span:
                span.set_data("url", url)
                span.set_data("sourcemap_url", sourcemap_url)
                sourcemap_cache = self._fetch_sourcemap_cache_by_url(
                    sourcemap_url,
                    source=minified_sourceview.get_source().encode("utf-8"),
                    use_url_new=use_url_new,
                )
        except http.BadSource as exc:
            # we don't perform the same check here as above, because if someone has
            # uploaded a node_modules file, which has a sourceMappingURL, they
            # presumably would like it mapped (and would like to know why it's not
            # working, if that's the case). If they're not looking for it to be
            # mapped, then they shouldn't be uploading the source file in the
            # first place.
            if use_url_new:
                self.fetch_by_url_new_errors.setdefault(url, []).append(exc.data)
            else:
                self.fetch_by_url_errors.setdefault(url, []).append(exc.data)

            return None
        else:
            if use_url_new:
                self.sourcemap_url_new_sourcemap_cache[sourcemap_url] = sourcemap_cache
            else:
                self.sourcemap_url_sourcemap_cache[sourcemap_url] = sourcemap_cache

            return sourcemap_cache

    def _fetch_sourcemap_cache_by_url(self, url, source=b"", use_url_new=False):
        if is_data_uri(url):
            try:
                body = base64.b64decode(
                    force_bytes(url[BASE64_PREAMBLE_LENGTH:])
                    + (b"=" * (-(len(url) - BASE64_PREAMBLE_LENGTH) % 4))
                )
            except binascii.Error as e:
                raise UnparseableSourcemap({"url": "<base64>", "reason": str(e)})
        else:
            # look in the database and, if not found, optionally try to scrape the web
            if use_url_new:
                with sentry_sdk.start_span(
                    op="JavaScriptStacktraceProcessor.fetch_sourcemap_view_by_url.fetch_by_url_new"
                ) as span:
                    span.set_data("url", url)

                    result = self.fetcher.fetch_by_url_new(url)
                    # In case we are fetching with url new we want to early return None in case we didn't find a match.
                    # This is because we want to fallback to the old system "fetch_by_url" before throwing the
                    # definitive error "UnparseableSourcemap".
                    if result is None:
                        return None
            else:
                with sentry_sdk.start_span(
                    op="JavaScriptStacktraceProcessor.fetch_sourcemap_view_by_url.fetch_by_url"
                ) as span:
                    span.set_data("url", url)

                    result = self.fetcher.fetch_by_url(url)
                    # In case we are fetching with url and we have a None result, then we can throw an error since we
                    # are not able to parce the sourcemap.
                    if result is None:
                        raise UnparseableSourcemap({"url": http.expose_url(url)})

            body = result.body

        try:
            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.fetch_sourcemap_view_by_url.SmCache.from_bytes"
            ):
                # This is an expensive operation that should be executed as few times as possible.
                return SmCache.from_bytes(source, body)
        except Exception as exc:
            # This is in debug because the product shows an error already.
            logger.debug(str(exc), exc_info=True)
            raise UnparseableSourcemap({"url": http.expose_url(url)})

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

        for idx, url in enumerate(pending_file_list):
            with sentry_sdk.start_span(
                op="JavaScriptStacktraceProcessor.populate_source_cache.cache_source"
            ) as span:
                span.set_data("url", url)
                debug_id = self.abs_path_debug_id.get(url)
                # We first want to fetch the minified sourceview either by debug_id or url.
                self.get_or_fetch_sourceview(
                    url=url, debug_id=debug_id, source_file_type=SourceFileType.MINIFIED_SOURCE
                )

    def close(self):
        StacktraceProcessor.close(self)
        # We want to close all the open archives inside the local Fetcher cache.
        self.fetcher.close()
        if self.sourcemaps_touched:
            metrics.incr(
                "sourcemaps.processed", amount=len(self.sourcemaps_touched), skip_internal=True
            )

        # If we do some A/B testing for symbolicator, we want to compare the stack traces
        # processed by both the existing processor (this one), and the symbolicator result,
        # and log any differences.
        # Q: what do we want to diff? raw/_stacktraces? With the full source context?
        # Processing Errors?
        # We also need to account for known differences? Like symbolicator not
        # outputting a trailing empty line, whereas the python processor does.
        if symbolicator_stacktraces := self.data.pop("symbolicator_stacktraces", None):

            metrics.incr("sourcemaps.ab-test.performed")

            # TODO: we currently have known differences:
            # - python prefixes sourcemaps fetched by debug-id with `debug-id://`
            # - some insignificant differences in source context application
            #   related to different column offsets
            # - python adds a `data.sourcemap` even if none was fetched successfully
            interesting_keys = {
                "abs_path",
                "filename",
                "lineno",
                "colno",
                "function",
                "context_line",
                "module",
                "in_app",
            }
            known_diffs = {
                "context_line",
                "data.sourcemap",
            }

            def filtered_frame(frame: dict) -> dict:
                new_frame = {key: value for key, value in frame.items() if key in interesting_keys}

                ds = get_path(frame, "data", "sourcemap")
                # The python code does some trimming of the `data.sourcemap` prop to
                # 150 characters with a trailing `...`, so replicate this here to avoid some
                # bogus differences
                if ds is not None and len(ds) > 150:
                    ds = ds[:147] + "..."
                new_frame["data.sourcemap"] = ds

                # The code in `get_event_preprocessors` backfills the `module`.
                # Contrary to its name, this runs *after* the stacktrace processor,
                # so we want to backfill this here for all the frames as well:
                abs_path = new_frame.get("abs_path")
                if (
                    new_frame.get("module") is None
                    and abs_path
                    and abs_path.startswith(("http:", "https:", "webpack:", "app:"))
                ):
                    new_frame["module"] = generate_module(abs_path)

                return new_frame

            def without_known_diffs(frame: dict) -> dict:
                {key: value for key, value in frame.items() if key not in known_diffs}

            different_frames = []
            for symbolicator_stacktrace, stacktrace_info in zip(
                symbolicator_stacktraces,
                (
                    sinfo
                    for sinfo in self.stacktrace_infos
                    # only include `stacktrace_infos` that have a stacktrace with frames
                    if get_path(sinfo.container, "stacktrace", "frames", filter=True)
                ),
            ):
                python_stacktrace = stacktrace_info.container.get("stacktrace")

                for symbolicator_frame, python_frame in zip(
                    symbolicator_stacktrace,
                    python_stacktrace["frames"],
                ):
                    symbolicator_frame = filtered_frame(symbolicator_frame)
                    python_frame = filtered_frame(python_frame)

                    if symbolicator_frame != python_frame:
                        # skip some insignificant differences
                        if without_known_diffs(symbolicator_frame) == without_known_diffs(
                            python_frame
                        ):
                            # python emits a `debug-id://` prefix whereas symbolicator does not
                            # OR: python adds a `data.sourcemap` even though it could not be resolved
                            if (
                                python_frame.get("data.sourcemap", "").startswith("debug-id://")
                                or symbolicator_frame.get("data.sourcemap") is None
                            ):
                                continue

                            # with minified files and high column numbers, we might have a difference in
                            # source context slicing, probably due to encodings
                            if python_frame.get("colno", 0) > 10_000 and python_frame.get(
                                "context_line"
                            ) != symbolicator_frame.get("context_line"):
                                continue

                        different_frames.append(
                            {"symbolicator": symbolicator_frame, "python": python_frame}
                        )

            if different_frames:
                with sentry_sdk.push_scope() as scope:
                    scope.set_extra("different_frames", different_frames)
                    scope.set_extra("event_id", self.data.get("event_id"))
                    sentry_sdk.capture_message(
                        "JS symbolication differences between symbolicator and python."
                    )

    def suspected_console_errors(self, frames):
        def is_suspicious_frame(frame) -> bool:
            function = frame.get("function", None)
            filename = frame.get("filename", None)
            return function == "?" and filename == "<anonymous>"

        def has_suspicious_frames(frames) -> bool:
            if len(frames) == 2 and is_suspicious_frame(frames[0]):
                return True
            return all(is_suspicious_frame(frame) for frame in frames)

        for info in self.stacktrace_infos:
            is_exception = info.is_exception and info.container
            mechanism = info.container.get("mechanism") if is_exception else None
            error_type = info.container.get("type") if is_exception else None

            if (
                not frames
                or not mechanism
                or mechanism.get("type") != "onerror"
                or mechanism.get("handled")
            ):
                return False

            has_short_stacktrace = len(frames) <= 2
            is_suspicious_error = error_type.lower() in [
                "syntaxerror",
                "referenceerror",
                "typeerror",
            ]

            return has_short_stacktrace and is_suspicious_error and has_suspicious_frames(frames)
        return False
