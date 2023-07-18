import base64
import logging
import sys
from copy import deepcopy
from datetime import datetime

import jsonschema
import sentry_sdk
from django.conf import settings
from django.urls import reverse

from sentry import features, options
from sentry.auth.system import get_system_token
from sentry.models.project import Project
from sentry.utils import json, redis, safe

logger = logging.getLogger(__name__)

INTERNAL_SOURCE_NAME = "sentry:project"

VALID_LAYOUTS = ("native", "symstore", "symstore_index2", "ssqp", "unified", "debuginfod")

VALID_FILE_TYPES = ("pe", "pdb", "mach_debug", "mach_code", "elf_debug", "elf_code", "breakpad")

VALID_CASINGS = ("lowercase", "uppercase", "default")

LAYOUT_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": list(VALID_LAYOUTS)},
        "casing": {"type": "string", "enum": list(VALID_CASINGS)},
    },
    "required": ["type"],
    "additionalProperties": False,
}

COMMON_SOURCE_PROPERTIES = {
    "id": {"type": "string", "minLength": 1},
    "name": {"type": "string"},
    "layout": LAYOUT_SCHEMA,
    "filetypes": {"type": "array", "items": {"type": "string", "enum": list(VALID_FILE_TYPES)}},
}

APP_STORE_CONNECT_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["appStoreConnect"]},
        "id": {"type": "string", "minLength": 1},
        "name": {"type": "string"},
        "appconnectIssuer": {"type": "string", "minLength": 36, "maxLength": 36},
        "appconnectKey": {"type": "string", "minLength": 2, "maxLength": 20},
        "appconnectPrivateKey": {"type": "string"},
        "appName": {"type": "string", "minLength": 1, "maxLength": 512},
        "appId": {"type": "string", "minLength": 1},
        "bundleId": {"type": "string", "minLength": 1},
    },
    "required": [
        "type",
        "id",
        "name",
        "appconnectIssuer",
        "appconnectKey",
        "appconnectPrivateKey",
        "appName",
        "appId",
        "bundleId",
    ],
    "additionalProperties": False,
}

HTTP_SOURCE_SCHEMA = {
    "type": "object",
    "properties": dict(
        type={"type": "string", "enum": ["http"]},
        url={"type": "string"},
        username={"type": "string"},
        password={"type": "string"},
        **COMMON_SOURCE_PROPERTIES,
    ),
    "required": ["type", "id", "url", "layout"],
    "additionalProperties": False,
}

S3_SOURCE_SCHEMA = {
    "type": "object",
    "properties": dict(
        type={"type": "string", "enum": ["s3"]},
        bucket={"type": "string"},
        region={"type": "string"},
        access_key={"type": "string"},
        secret_key={"type": "string"},
        prefix={"type": "string"},
        **COMMON_SOURCE_PROPERTIES,
    ),
    "required": ["type", "id", "bucket", "region", "access_key", "secret_key", "layout"],
    "additionalProperties": False,
}

GCS_SOURCE_SCHEMA = {
    "type": "object",
    "properties": dict(
        type={"type": "string", "enum": ["gcs"]},
        bucket={"type": "string"},
        client_email={"type": "string"},
        private_key={"type": "string"},
        prefix={"type": "string"},
        **COMMON_SOURCE_PROPERTIES,
    ),
    "required": ["type", "id", "bucket", "client_email", "private_key", "layout"],
    "additionalProperties": False,
}

SOURCES_SCHEMA = {
    "type": "array",
    "items": {
        "oneOf": [HTTP_SOURCE_SCHEMA, S3_SOURCE_SCHEMA, GCS_SOURCE_SCHEMA, APP_STORE_CONNECT_SCHEMA]
    },
}

LAST_UPLOAD_TTL = 24 * 3600


def _get_cluster():
    cluster_key = settings.SENTRY_DEBUG_FILES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)


def _last_upload_key(project_id: int) -> str:
    return f"symbols:last_upload:{project_id}"


def record_last_upload(project: Project):
    timestamp = int(datetime.utcnow().timestamp() * 1000)
    _get_cluster().setex(_last_upload_key(project.id), LAST_UPLOAD_TTL, timestamp)


def get_last_upload(project_id: int):
    return _get_cluster().get(_last_upload_key(project_id))


class InvalidSourcesError(Exception):
    pass


def get_internal_url_prefix() -> str:
    """
    Returns the `internal-url-prefix` normalized in such a way that it works in local
    development environments.
    """
    internal_url_prefix = options.get("system.internal-url-prefix")
    if not internal_url_prefix:
        internal_url_prefix = options.get("system.url-prefix")
        if sys.platform == "darwin":
            internal_url_prefix = internal_url_prefix.replace(
                "localhost", "host.docker.internal"
            ).replace("127.0.0.1", "host.docker.internal")

    assert internal_url_prefix
    return internal_url_prefix.rstrip("/")


def get_internal_source(project: Project):
    """
    Returns the source configuration for a Sentry project.
    """
    sentry_source_url = "{}{}".format(
        get_internal_url_prefix(),
        reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        ),
    )

    if last_upload := get_last_upload(project.id):
        # Adding a random query string parameter here makes sure that the
        # Symbolicator-internal `list_files` cache that is querying this API
        # is not being hit. This means that uploads will be immediately visible
        # to Symbolicator, and not depending on its internal cache TTL.
        sentry_source_url += f"?_last_upload={last_upload}"

    return {
        "type": "sentry",
        "id": INTERNAL_SOURCE_NAME,
        "url": sentry_source_url,
        "token": get_system_token(),
    }


def get_internal_artifact_lookup_source_url(project: Project):
    """
    Returns the url used as a part of source configuration for the Sentry artifact-lookup API.
    """
    return "{}{}".format(
        get_internal_url_prefix(),
        reverse(
            "sentry-api-0-project-artifact-lookup",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
            },
        ),
    )


def get_internal_artifact_lookup_source(project: Project):
    """
    Returns the source configuration for the Sentry artifact-lookup API.
    """
    return {
        "type": "sentry",
        "id": INTERNAL_SOURCE_NAME,
        "url": get_internal_artifact_lookup_source_url(project),
        "token": get_system_token(),
    }


def is_internal_source_id(source_id: str):
    """Determines if a DIF object source identifier is reserved for internal sentry use.

    This is trivial, but multiple functions in this file need to use the same definition.
    """
    return source_id.startswith("sentry")


def normalize_user_source(source):
    """Sources supplied from the user frontend might not match the format that
    symbolicator expects.  For instance we currently do not permit headers to be
    configured in the UI, but we allow basic auth to be configured for HTTP.
    This means that we need to convert from username/password into the HTTP
    basic auth header.
    """
    if source.get("type") == "http":
        username = source.pop("username", None)
        password = source.pop("password", None)
        if username or password:
            auth = base64.b64encode(
                ("{}:{}".format(username or "", password or "")).encode("utf-8")
            )
            source["headers"] = {
                "authorization": "Basic %s" % auth.decode("ascii"),
            }
    return source


def secret_fields(source_type):
    """
    Returns a string list of all of the fields that contain a secret in a given source.
    """
    if source_type == "appStoreConnect":
        yield from ["appconnectPrivateKey"]
    elif source_type == "http":
        yield "password"
    elif source_type == "s3":
        yield "secret_key"
    elif source_type == "gcs":
        yield "private_key"
    yield from []


def parse_sources(config, filter_appconnect=True):
    """
    Parses the given sources in the config string (from JSON).
    """

    if not config:
        return []

    try:
        sources = json.loads(config)
    except Exception as e:
        raise InvalidSourcesError(f"{e}")

    try:
        jsonschema.validate(sources, SOURCES_SCHEMA)
    except jsonschema.ValidationError as e:
        raise InvalidSourcesError(f"{e}")

    # remove App Store Connect sources (we don't need them in Symbolicator)
    if filter_appconnect:
        filter(lambda src: src.get("type") != "appStoreConnect", sources)

    ids = set()
    for source in sources:
        if is_internal_source_id(source["id"]):
            raise InvalidSourcesError('Source ids must not start with "sentry:"')
        if source["id"] in ids:
            raise InvalidSourcesError("Duplicate source id: {}".format(source["id"]))
        ids.add(source["id"])

    return sources


def parse_backfill_sources(sources_json, original_sources):
    """
    Parses a json string of sources passed in from a client and backfills any redacted secrets by
    finding their previous values stored in original_sources.
    """

    if not sources_json:
        return []

    try:
        sources = json.loads(sources_json)
    except Exception as e:
        raise InvalidSourcesError("Sources are not valid serialised JSON") from e

    orig_by_id = {src["id"]: src for src in original_sources}

    ids = set()
    for source in sources:
        if is_internal_source_id(source["id"]):
            raise InvalidSourcesError('Source ids must not start with "sentry:"')
        if source["id"] in ids:
            raise InvalidSourcesError("Duplicate source id: {}".format(source["id"]))

        ids.add(source["id"])

        for secret in secret_fields(source["type"]):
            if secret in source and source[secret] == {"hidden-secret": True}:
                secret_value = safe.get_path(orig_by_id, source["id"], secret)
                if secret_value is None:
                    with sentry_sdk.push_scope():
                        sentry_sdk.set_tag("missing_secret", secret)
                        sentry_sdk.set_tag("source_id", source["id"])
                        sentry_sdk.capture_message(
                            "Obfuscated symbol source secret does not have a corresponding saved value in project options"
                        )
                    raise InvalidSourcesError("Hidden symbol source secret is missing a value")
                else:
                    source[secret] = secret_value

    try:
        jsonschema.validate(sources, SOURCES_SCHEMA)
    except jsonschema.ValidationError as e:
        raise InvalidSourcesError("Sources did not validate JSON-schema") from e

    return sources


def redact_source_secrets(config_sources: json.JSONData) -> json.JSONData:
    """
    Returns a JSONData with all of the secrets redacted from every source.

    The original value is not mutated in the process; A clone is created
    and returned by this function.
    """

    redacted_sources = deepcopy(config_sources)
    for source in redacted_sources:
        for secret in secret_fields(source["type"]):
            if secret in source:
                source[secret] = {"hidden-secret": True}

    return redacted_sources


def get_sources_for_project(project):
    """
    Returns a list of symbol sources for this project.
    """

    sources = []

    # The symbolicator evaluates sources in the order they are declared. Always
    # try to download symbols from Sentry first.
    project_source = get_internal_source(project)
    sources.append(project_source)

    # Check that the organization still has access to symbol sources. This
    # controls both builtin and external sources.
    organization = project.organization

    if not features.has("organizations:symbol-sources", organization):
        return sources

    # Custom sources have their own feature flag. Check them independently.
    if features.has("organizations:custom-symbol-sources", organization):
        sources_config = project.get_option("sentry:symbol_sources")
    else:
        sources_config = None

    if sources_config:
        try:
            custom_sources = parse_sources(sources_config)
            sources.extend(
                normalize_user_source(source)
                for source in custom_sources
                if source["type"] != "appStoreConnect"
            )
        except InvalidSourcesError:
            # Source configs should be validated when they are saved. If this
            # did not happen, this indicates a bug. Record this, but do not stop
            # processing at this point.
            logger.error("Invalid symbolicator source config", exc_info=True)

    def resolve_alias(source):
        for key in source.get("sources") or ():
            other_source = settings.SENTRY_BUILTIN_SOURCES.get(key)
            if other_source:
                if other_source.get("type") == "alias":
                    yield from resolve_alias(other_source)
                else:
                    yield other_source

    # Add builtin sources last to ensure that custom sources have precedence
    # over our defaults.
    builtin_sources = project.get_option("sentry:builtin_symbol_sources")
    for key, source in settings.SENTRY_BUILTIN_SOURCES.items():
        if key not in builtin_sources:
            continue

        # special internal alias type expands to more than one item.  This
        # is used to make `apple` expand to `ios`/`macos` and other
        # sources if configured as such.
        if source.get("type") == "alias":
            sources.extend(resolve_alias(source))
        else:
            sources.append(source)

    return sources


def reverse_aliases_map(builtin_sources):
    """Returns a map of source IDs to their original un-aliased source ID.

    :param builtin_sources: The value of `settings.SENTRY_BUILTIN_SOURCES`.
    """
    reverse_aliases = dict()
    for key, source in builtin_sources.items():
        if source.get("type") != "alias":
            continue
        try:
            self_id = source["id"]
        except KeyError:
            continue
        for aliased_source in source.get("sources", []):
            try:
                aliased_source = builtin_sources[aliased_source]
                aliased_id = aliased_source["id"]
            except KeyError:
                continue
            reverse_aliases[aliased_id] = self_id
    return reverse_aliases


def filter_ignored_sources(sources, reversed_alias_map=None):
    """
    Filters out sources that are meant to be blocked based on a global killswitch. If any sources
    were de-aliased, a reverse mapping of { unaliased id: alias } should be provided for this to
    also recognize and filter out aliased sources.
    """

    ignored_source_ids = options.get("symbolicator.ignored_sources")
    if not ignored_source_ids:
        return sources

    filtered = []
    for src in sources:
        resolved = src["id"]
        alias = reversed_alias_map is not None and reversed_alias_map.get(resolved) or resolved
        # This covers three scenarios:
        # 1. The source had an alias, and the config may have used that alias to block it (alias map
        #    lookup resolved)
        # 2. The source had no alias, and the config may have used the source's ID to block it
        #    (alias map lookup returned None and fell back to resolved)
        # 3. The source had an alias, but the config used the source's internal unaliased ID to
        #    block it (alias map lookup resolved but not in ignored_source_ids, resolved is in
        #    ignored_source_ids)
        if alias not in ignored_source_ids and resolved not in ignored_source_ids:
            filtered.append(src)
    return filtered


def redact_internal_sources(response):
    """Redacts information about internal sources from a response.

    Symbolicator responses can contain a section about DIF object file candidates where were
    attempted to be downloaded from the sources.  This includes a full URI of where the
    download was attempted from.  For internal sources we want to redact this in order to
    not leak any internal details.

    Note that this modifies the argument passed in, thus redacting in-place.  It still
    returns the modified response.
    """
    for module in response.get("modules", []):
        redact_internal_sources_from_module(module)


def redact_internal_sources_from_module(module):
    """Redacts information about internal sources from a single module.

    This in-place redacts candidates from only a single module of the symbolicator response.

    The strategy here is for each internal source to replace the location with the DebugID.
    Furthermore if there are any "notfound" entries collapse them into a single entry and
    only show this entry if there are no entries with another status.
    """
    sources_notfound = set()
    sources_other = set()
    new_candidates = []

    for candidate in module.get("candidates", []):
        source_id = candidate["source"]
        if is_internal_source_id(source_id):

            # Only keep location for sentry:project.
            if source_id != "sentry:project":
                candidate.pop("location", None)

            # Collapse nofound statuses, collect info on sources which both have a notfound
            # as well as other statusses.  This allows us to later filter the notfound ones.
            try:
                status = candidate.get("download", {})["status"]
            except KeyError:
                pass
            else:
                if status == "notfound":
                    candidate.pop("location", None)  # This location is bogus, remove it.
                    if source_id in sources_notfound:
                        continue
                    else:
                        sources_notfound.add(source_id)
                else:
                    sources_other.add(source_id)
        new_candidates.append(candidate)

    def should_keep(candidate):
        """Returns `False` if the candidate should be kept in the list of candidates.

        This removes the candidates with a status of ``notfound`` *if* they also have
        another status.
        """
        source_id = candidate["source"]
        status = candidate.get("download", {}).get("status")
        return status != "notfound" or source_id not in sources_other

    if "candidates" in module:
        module["candidates"] = [c for c in new_candidates if should_keep(c)]


def sources_for_symbolication(project):
    """
    Returns a list of symbol sources to attach to a native symbolication request,
    as well as a closure to post-process the resulting JSON response.
    """

    sources = get_sources_for_project(project) or []

    # Build some maps for use in _process_response()
    reverse_source_aliases = reverse_aliases_map(settings.SENTRY_BUILTIN_SOURCES)
    source_names = {source["id"]: source.get("name", "unknown") for source in sources}

    # Add a name for the special "sentry:project" source.
    source_names[INTERNAL_SOURCE_NAME] = "Sentry"

    # Add names for aliased sources.
    for source in settings.SENTRY_BUILTIN_SOURCES.values():
        if source.get("type") == "alias":
            source_names[source["id"]] = source.get("name", "unknown")

    # Remove sources that should be ignored. This leaves a few extra entries in the alias
    # maps and source names maps, but that's fine. The orphaned entries in the maps will just
    # never be used.
    sources = filter_ignored_sources(sources, reverse_source_aliases)

    def _process_response(json):
        """Post-processes the JSON response.

        This modifies the candidates list from Symbolicator responses to undo aliased
        sources, hide information about unknown sources and add names to sources rather then
        just have their IDs.
        """
        for module in json.get("modules") or ():
            for candidate in module.get("candidates") or ():
                # Reverse internal source aliases from the response.
                source_id = candidate["source"]
                original_source_id = reverse_source_aliases.get(source_id)
                if original_source_id is not None:
                    candidate["source"] = original_source_id
                    source_id = original_source_id

                # Add a "source_name" field to save the UI a lookup.
                candidate["source_name"] = source_names.get(source_id, "unknown")

        redact_internal_sources(json)
        return json

    return (sources, _process_response)
