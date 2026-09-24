from __future__ import annotations

import base64
import logging
import os
from collections.abc import Mapping
from copy import deepcopy
from dataclasses import dataclass, replace
from functools import cached_property
from typing import Any, TypeAlias
from uuid import uuid4

import google.auth
import jsonschema
import orjson
import sentry_sdk
from cachetools.func import ttl_cache
from django.conf import settings
from django.urls import reverse
from google.auth import impersonated_credentials
from google.auth.transport.requests import Request
from sentry_redis_tools.clients import RedisCluster

from sentry import features, options
from sentry.auth.system import get_system_token
from sentry.models.project import Project
from sentry.utils import redis
from sentry.utils.dates import deprecated_utcnow
from sentry.utils.http import get_origins

logger = logging.getLogger(__name__)

INTERNAL_SOURCE_NAME = "sentry:project"

Source: TypeAlias = dict[str, Any]
"""A symbol source as stored in the project option. Its key set depends on the kind."""

# The header in which to send the project ID to custom symbol sources.
PROJECT_ID_HEADER = "x-sentry-project-id"

# The header in which to send the event ID to custom symbol sources.
EVENT_ID_HEADER = "x-sentry-event-id"

HIDDEN_SECRET = {"hidden-secret": True}
HIDDEN_SECRET_SCHEMA = {
    "type": "object",
    "properties": {"hidden-secret": {"type": "boolean", "enum": [True]}},
}


@dataclass(frozen=True)
class Field:
    """
    One property of a symbol source.

    `schema` is the JSON schema of the value. `description` is shown in the
    API docs; a field without one is accepted but not documented.
    """

    schema: Mapping[str, Any]
    description: str | None = None
    required: bool = False
    secret: bool = False

    def json_schema(self, *, redacted: bool = False) -> dict[str, Any]:
        schema = dict(HIDDEN_SECRET_SCHEMA if redacted and self.secret else self.schema)
        if self.description:
            schema["description"] = self.description
        return schema


def string(description: str | None, *, required: bool = False, secret: bool = False) -> Field:
    return Field({"type": "string"}, description, required, secret)


def boolean(description: str | None) -> Field:
    return Field({"type": "boolean"}, description)


def strings(description: str | None) -> Field:
    return Field({"type": "array", "items": {"type": "string"}}, description)


def choice(
    description: str, options: Mapping[str, str], *, required: bool = False, many: bool = False
) -> Field:
    """`options` maps each allowed value to the label shown in the docs."""
    schema: dict[str, Any] = {"type": "string", "enum": list(options)}
    if many:
        schema = {"type": "array", "items": schema}
    listing = "\n".join(f"- `{value}` - {label}" for value, label in options.items())
    return Field(schema, f"{description} The options are:\n{listing}", required)


def nested(description: str, *, required: bool = False, **fields: Field) -> Field:
    return Field(object_schema(fields), description, required)


def object_schema(fields: Mapping[str, Field], *, redacted: bool = False) -> dict[str, Any]:
    schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            name: field.json_schema(redacted=redacted) for name, field in fields.items()
        },
        "additionalProperties": False,
    }
    if required := [name for name, field in fields.items() if field.required]:
        schema["required"] = required
    return schema


LAYOUTS = {
    "native": "Platform-Specific (SymStore / GDB / LLVM)",
    "symstore": "Microsoft SymStore",
    "symstore_index2": "Microsoft SymStore (with index2.txt)",
    "ssqp": "Microsoft SSQP",
    "unified": "Unified Symbol Server Layout",
    "debuginfod": "debuginfod",
    "slashsymbols": "Slash Symbols",
}

CASINGS = {
    "default": "Default (mixed case)",
    "uppercase": "Uppercase",
    "lowercase": "Lowercase",
}

FILE_TYPES = {
    "pe": "Windows executable files",
    "pdb": "Windows debug files",
    "portablepdb": ".NET portable debug files",
    "mach_code": "MacOS executable files",
    "mach_debug": "MacOS debug files",
    "elf_code": "ELF executable files",
    "elf_debug": "ELF debug files",
    "wasm_code": "WASM executable files",
    "wasm_debug": "WASM debug files",
    "breakpad": "Breakpad symbol files",
    "sourcebundle": "Source code bundles",
    "uuidmap": "Apple UUID mapping files",
    "bcsymbolmap": "Apple bitcode symbol maps",
    "il2cpp": "Unity IL2CPP mapping files",
    "proguard": "ProGuard mapping files",
    "dartsymbolmap": "Dart symbol mapping files",
}

COMMON_FIELDS = {
    "id": Field(
        {"type": "string", "minLength": 1},
        "The internal ID of the source. Must be distinct from all other source IDs and cannot start with `sentry:`. If this is not provided, a new UUID will be generated.",
        required=True,
    ),
    "name": string("The human-readable name of the source."),
    "layout": nested(
        "Layout settings for the source.",
        required=True,
        type=choice("The layout of the folder structure.", LAYOUTS, required=True),
        casing=choice("The casing of the folder structure.", CASINGS),
    ),
    "filters": nested(
        "Filter settings for the source.",
        filetypes=choice(
            "A list of file types that can be found on this source. If this is left empty, all file types will be enabled.",
            FILE_TYPES,
            many=True,
        ),
        path_patterns=strings(
            "A list of glob patterns to check against the debug and code file paths of debug files. Only files that match one of these patterns will be requested from the source. If this is left empty, no path-based filtering takes place."
        ),
        requires_checksum=boolean(
            "Whether this source requires a debug checksum to be sent with each request. Defaults to `false`."
        ),
    ),
    # Set on builtin sources in settings. Stored custom sources may carry them
    # too, so they stay accepted, but the API does not document them.
    "is_public": boolean(None),
    "has_index": boolean(None),
    "platforms": strings(None),
}


class SourceKind:
    """
    One kind of symbol source, such as an HTTP symbol server or an S3 bucket.

    A kind declares the fields that are specific to it on top of the common
    ones. Validation, API docs, and secret redaction are derived from the
    declarations. To add a kind, declare it here and add it to `SOURCE_KINDS`.
    """

    def __init__(self, type: str, label: str, **fields: Field) -> None:
        self.type = type
        self.label = label
        self.fields: dict[str, Field] = {**COMMON_FIELDS, **fields}

    def extend(self, **fields: Field) -> SourceKind:
        return SourceKind(self.type, self.label, **{**self.fields, **fields})

    @property
    def secrets(self) -> list[str]:
        return [name for name, field in self.fields.items() if field.secret]

    def _fields_with_type(self, fields: Mapping[str, Field]) -> dict[str, Field]:
        return {"type": Field({"type": "string", "enum": [self.type]}, required=True), **fields}

    @cached_property
    def schema(self) -> dict[str, Any]:
        return object_schema(self._fields_with_type(self.fields))

    @cached_property
    def redacted_schema(self) -> dict[str, Any]:
        return object_schema(self._fields_with_type(self.fields), redacted=True)

    @cached_property
    def request_fields(self) -> dict[str, Field]:
        """The documented fields, as the API accepts them. The ID is assigned when absent."""
        fields = {name: field for name, field in self.fields.items() if field.description}
        fields["id"] = replace(fields["id"], required=False)
        return fields

    @cached_property
    def request_schema(self) -> dict[str, Any]:
        return object_schema(self._fields_with_type(self.request_fields))


HTTP = SourceKind(
    "http",
    "SymbolServer (HTTP)",
    url=string("The source's URL.", required=True),
    username=string("The user name for accessing the source."),
    password=string("The password for accessing the source.", secret=True),
)

S3 = SourceKind(
    "s3",
    "Amazon S3",
    bucket=string("The bucket where the source resides.", required=True),
    region=string(
        "The source's [S3 region](https://docs.aws.amazon.com/general/latest/gr/s3.html).",
        required=True,
    ),
    access_key=string(
        "The [AWS Access Key](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html#access-keys-and-secret-access-keys).",
        required=True,
    ),
    secret_key=string(
        "The [AWS Secret Access Key](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html#access-keys-and-secret-access-keys).",
        required=True,
        secret=True,
    ),
    prefix=string("The path prefix inside the bucket."),
)

GCS = SourceKind(
    "gcs",
    "Google Cloud Storage",
    bucket=string("The bucket where the source resides.", required=True),
    client_email=string("The GCS email address for authentication.", required=True),
    private_key=string("The GCS private key.", required=True, secret=True),
    prefix=string("The path prefix inside the bucket."),
)

# Builtin HTTP sources from settings may carry headers. We don't want to expose
# that functionality via the API.
BUILTIN_HTTP = HTTP.extend(
    headers=Field({"type": "object", "patternProperties": {".*": {"type": "string"}}}),
    accept_invalid_certs=boolean(None),
)

SOURCE_KINDS = {kind.type: kind for kind in (HTTP, S3, GCS)}

SECRET_FIELDS = frozenset(name for kind in SOURCE_KINDS.values() for name in kind.secrets)

# Sentry no longer supports App Store Connect sources. Old project options may
# still contain them; `parse_sources` drops them.
LEGACY_SOURCE_TYPES = frozenset({"appStoreConnect"})

SOURCE_SCHEMA = {"oneOf": [kind.schema for kind in SOURCE_KINDS.values()]}
SOURCES_SCHEMA = {"type": "array", "items": SOURCE_SCHEMA}

BUILTIN_SOURCE_SCHEMA = {"oneOf": [kind.schema for kind in (BUILTIN_HTTP, S3, GCS)]}

REDACTED_SOURCE_SCHEMA = {"oneOf": [kind.redacted_schema for kind in SOURCE_KINDS.values()]}
REDACTED_SOURCES_SCHEMA = {"type": "array", "items": REDACTED_SOURCE_SCHEMA}

LAST_UPLOAD_TTL = 24 * 3600

TOKEN_TTL_SECONDS = 3600


def _get_cluster() -> RedisCluster:
    cluster_key = settings.SENTRY_DEBUG_FILES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)


def _last_upload_key(project_id: int) -> str:
    return f"symbols:last_upload:{project_id}"


def record_last_upload(project: Project):
    timestamp = int(deprecated_utcnow().timestamp() * 1000)
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

        replacements = ["localhost", "127.0.0.1"]
        if "DJANGO_LIVE_TEST_SERVER_ADDRESS" in os.environ:
            replacements.append(os.environ["DJANGO_LIVE_TEST_SERVER_ADDRESS"])

        for replacement in replacements:
            internal_url_prefix = internal_url_prefix.replace(replacement, "host.docker.internal")

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
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
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
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        ),
    )


def get_scraping_config(project: Project) -> dict[str, Any]:
    allow_scraping_org_level = project.organization.get_option("sentry:scrape_javascript", True)
    allow_scraping_project_level = project.get_option("sentry:scrape_javascript", True)
    allow_scraping = allow_scraping_org_level and allow_scraping_project_level
    verify_ssl = project.get_option("sentry:verify_ssl", True)

    allowed_origins = []
    scraping_headers = {}
    if allow_scraping:
        allowed_origins = list(get_origins(project))

        if "*" not in allowed_origins:
            token = project.get_option("sentry:token")
            if token:
                token_header = project.get_option("sentry:token_header") or "X-Sentry-Token"
                scraping_headers[token_header] = token

    return {
        "enabled": allow_scraping,
        "headers": scraping_headers,
        "allowed_origins": allowed_origins,
        "verify_ssl": verify_ssl,
    }


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


def normalize_user_source(source, project_id=None, event_id=None):
    """Sources supplied from the user frontend might not match the format that
    symbolicator expects.  For instance we currently do not permit headers to be
    configured in the UI, but we allow basic auth to be configured for HTTP.
    This means that we need to convert from username/password into the HTTP
    basic auth header.

    Moreover, this inserts the project and event ID into the `x-sentry-project-id`
    and `x-sentry-event-id` headers, respectively.
    """
    if source.get("type") == "http":
        headers = {}

        # Auth
        username = source.pop("username", None)
        password = source.pop("password", None)
        if username or password:
            auth = base64.b64encode(
                ("{}:{}".format(username or "", password or "")).encode("utf-8")
            )
            headers["authorization"] = "Basic %s" % auth.decode("ascii")

        # Event & project ID
        if project_id:
            headers[PROJECT_ID_HEADER] = str(project_id)
        if event_id:
            headers[EVENT_ID_HEADER] = event_id

        if headers:
            source["headers"] = headers
    return source


def validate_sources(sources, schema=SOURCES_SCHEMA):
    """
    Validates sources against the JSON schema and checks that
    their IDs are ok.
    """
    try:
        jsonschema.validate(sources, schema)
    except jsonschema.ValidationError:
        raise InvalidSourcesError(f"Failed to validate source {redact_source_secrets(sources)}")

    ids = set()
    for source in sources:
        if is_internal_source_id(source["id"]):
            raise InvalidSourcesError('Source ids must not start with "sentry:"')
        if source["id"] in ids:
            raise InvalidSourcesError("Duplicate source id: {}".format(source["id"]))
        ids.add(source["id"])


def parse_sources(config):
    """
    Parses the sources stored in a project option. Sources of a kind Sentry no
    longer supports are dropped.
    """

    if not config:
        return []

    try:
        sources = orjson.loads(config)
    except Exception as e:
        raise InvalidSourcesError("Sources are not valid serialised JSON") from e

    sources = [src for src in sources if src.get("type") not in LEGACY_SOURCE_TYPES]
    validate_sources(sources)

    return sources


def parse_backfill_sources(sources_json, original_sources):
    """
    Parses a json string of sources passed in from a client and backfills any redacted secrets by
    finding their previous values stored in original_sources.
    """

    if not sources_json:
        return []

    try:
        sources = orjson.loads(sources_json)
    except Exception as e:
        raise InvalidSourcesError("Sources are not valid serialised JSON") from e

    orig_by_id = {src["id"]: src for src in original_sources}

    for source in sources:
        backfill_secrets(source, orig_by_id.get(source["id"]))

    validate_sources(sources, schema=SOURCES_SCHEMA)

    return sources


def backfill_secrets(source: Source, previous: Source | None) -> None:
    """
    Replaces every `{"hidden-secret": true}` placeholder in `source` with the
    real value from `previous`, the stored source it updates.
    """
    for field in SECRET_FIELDS:
        if source.get(field) != HIDDEN_SECRET:
            continue
        value = previous.get(field) if previous else None
        if value is None:
            with sentry_sdk.isolation_scope():
                sentry_sdk.set_tag("missing_secret", field)
                sentry_sdk.set_tag("source_id", source.get("id"))
                sentry_sdk.capture_message(
                    "Obfuscated symbol source secret does not have a corresponding saved value in project options"
                )
            raise InvalidSourcesError("Hidden symbol source secret is missing a value")
        source[field] = value


def redact_source_secrets(config_sources: Any) -> Any:
    """
    Returns a json data with all of the secrets redacted from every source.

    The original value is not mutated in the process; A clone is created
    and returned by this function.
    """

    redacted_sources = deepcopy(config_sources)
    for source in redacted_sources:
        for field in SECRET_FIELDS:
            if field in source:
                source[field] = HIDDEN_SECRET

    return redacted_sources


class UnknownSourceId(Exception):
    pass


class ProjectSymbolSources:
    """
    The custom symbol sources of one project.

    Hides the `sentry:symbol_sources` project option, its JSON encoding, and
    secret handling. Every mutation validates the whole list and saves it, so
    a caller cannot store an invalid list or forget to save. Every source that
    leaves this class has its secrets redacted.
    """

    OPTION = "sentry:symbol_sources"

    def __init__(self, project: Project, sources: list[Source]) -> None:
        self._project = project
        self._sources = sources

    @classmethod
    def load(cls, project: Project) -> ProjectSymbolSources:
        config = project.get_option(cls.OPTION)
        return cls(project, parse_sources(config))

    def all(self) -> list[Source]:
        return redact_source_secrets(self._sources)

    def get(self, source_id: str | None) -> Source:
        return redact_source_secrets([self._sources[self._index_of(source_id)]])[0]

    def add(self, source: Source) -> Source:
        source = {**source}
        source.setdefault("id", str(uuid4()))
        self._save([*self._sources, source])
        return redact_source_secrets([source])[0]

    def replace(self, source_id: str | None, source: Source) -> Source:
        """
        Replaces the source with `source_id` by `source`. The new source keeps
        its own ID, or gets a fresh one when it has none. Hidden secrets in
        `source` are backfilled from the source it replaces.
        """
        index = self._index_of(source_id)
        source = {**source}
        source.setdefault("id", str(uuid4()))
        backfill_secrets(source, self._sources[index])
        self._save([*self._sources[:index], source, *self._sources[index + 1 :]])
        return redact_source_secrets([source])[0]

    def remove(self, source_id: str | None) -> None:
        index = self._index_of(source_id)
        self._save([*self._sources[:index], *self._sources[index + 1 :]])

    def _index_of(self, source_id: str | None) -> int:
        if source_id is None:
            raise UnknownSourceId("Missing source id")
        for index, source in enumerate(self._sources):
            if source["id"] == source_id:
                return index
        raise UnknownSourceId(f"Unknown source id: {source_id}")

    def _save(self, sources: list[Source]) -> None:
        validate_sources(sources)
        self._project.update_option(self.OPTION, orjson.dumps(sources).decode())
        self._sources = sources


def get_sources_for_project(project, event_id=None):
    """
    Returns a list of symbol sources for this project.
    """

    sources = []

    # The symbolicator evaluates sources in the order they are declared. Always
    # try to download symbols from Sentry first.
    project_source = get_internal_source(project)
    sources.append(project_source)

    organization = project.organization

    # Custom sources have their own feature flag. Check them independently.
    if features.has("organizations:custom-symbol-sources", organization):
        sources_config = project.get_option("sentry:symbol_sources")
    else:
        sources_config = None

    if sources_config:
        try:
            custom_sources = parse_sources(sources_config)
            sources.extend(
                normalize_user_source(source, project.id, event_id) for source in custom_sources
            )
        except InvalidSourcesError:
            # Source configs should be validated when they are saved. If this
            # did not happen, this indicates a bug. Record this, but do not stop
            # processing at this point.
            logger.exception("Invalid symbolicator source config")

    def resolve_alias(source, organization):
        for key in source.get("sources") or ():
            other_source = settings.SENTRY_BUILTIN_SOURCES.get(key)
            if other_source:
                if other_source.get("type") == "alias":
                    yield from resolve_alias(other_source, organization)
                else:
                    yield fetch_token_for_gcp_source_if_necessary(other_source, organization)

    def fetch_token_for_gcp_source_if_necessary(source, organization):
        if source.get("type") == "gcs":
            if "client_email" in source and "private_key" in source:
                return source
            else:
                client_email = source.get("client_email")
                token = get_gcp_token(client_email)
                # if target_credentials.token is None it means that the
                # token could not be fetched successfully
                if token is not None:
                    # Create a new dict to avoid reference issues
                    source = deepcopy(source)
                    source["bearer_token"] = token

                    # Remove other credentials if we have a token
                    if "client_email" in source:
                        del source["client_email"]
                    if "private_key" in source:
                        del source["private_key"]

        return source

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
            sources.extend(resolve_alias(source, organization))
        else:
            sources.append(fetch_token_for_gcp_source_if_necessary(source, organization))

    return sources


# Expire the cached token 10 minutes earlier so that we can confidently pass it
# to symbolicator with its configured timeout of 5 minutes
@ttl_cache(ttl=TOKEN_TTL_SECONDS - 600)
def get_gcp_token(client_email):
    # Fetch the regular credentials for GCP
    source_credentials, _ = google.auth.default()

    if source_credentials is None:
        return None

    # Impersonate the service account to give the token for symbolicator a proper scope
    target_credentials = impersonated_credentials.Credentials(
        source_credentials=source_credentials,
        target_principal=client_email,
        target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
        lifetime=TOKEN_TTL_SECONDS,
    )

    target_credentials.refresh(Request())

    if target_credentials.token is None:
        return None

    return target_credentials.token


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


def sources_for_symbolication(project, event_id=None):
    """
    Returns a list of symbol sources to attach to a native symbolication request,
    as well as a closure to post-process the resulting JSON response.
    """

    sources = get_sources_for_project(project, event_id) or []

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
        try:
            collect_apple_symbol_stats(json)
        except Exception as e:
            sentry_sdk.capture_exception(e)
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


def collect_apple_symbol_stats(json):
    eligible_symbols = 0
    neither_has_symbol = 0
    both_have_symbol = 0
    # Done to temporally collect information about the events for which we don't find symbols in symx:
    old_has_symbol = []
    symx_has_symbol = 0

    for module in json.get("modules") or ():
        if (
            module.get("debug_status", "unused") == "unused"
            and module.get("unwind_status", "unused") == "unused"
        ):
            continue

        if module["type"] != "macho":
            continue

        eligible_symbols += 1

        old_found_source = None
        symx_has_this_symbol = False
        for candidate in module.get("candidates") or ():
            if candidate["download"]["status"] == "ok":
                source_id = candidate["source"]
                if source_id.startswith("sentry:symx"):
                    symx_has_this_symbol = True
                # only compare symx to the system symbol source
                elif (
                    source_id.startswith("sentry:")
                    and not source_id.startswith("sentry:symbol-collector")
                    and source_id.endswith("os-source")
                ):
                    old_found_source = source_id

        if symx_has_this_symbol:
            if old_found_source:
                both_have_symbol += 1
            else:
                symx_has_symbol += 1
        elif old_found_source:
            old_has_symbol.append(
                {
                    "arch": module.get("arch"),
                    "code_file": module.get("code_file"),
                    "debug_id": module.get("debug_id"),
                    "found_in": old_found_source,
                }
            )
        else:
            neither_has_symbol += 1
            # NOTE: It might be possible to apply a heuristic based on `code_file` here to figure out if this is
            # supposed to be a system symbol, and maybe also log those cases specifically as internal messages. For
            # now, we are only interested in rough numbers.

    if eligible_symbols:
        apple_symbol_stats = {
            "both": both_have_symbol,
            "neither": neither_has_symbol,
            "symx": symx_has_symbol,
            "old": old_has_symbol,
        }

        json["apple_symbol_stats"] = apple_symbol_stats
