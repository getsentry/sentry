"""
The kinds of symbol source a project can configure, and the schemas derived
from them.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import replace
from enum import StrEnum
from functools import cached_property
from typing import Any

from sentry.lang.native.source_schema import (
    Field,
    boolean,
    choice,
    nested,
    object_schema,
    string,
    strings,
)


class SourceType(StrEnum):
    HTTP = "http"
    S3 = "s3"
    GCS = "gcs"


class Layout(StrEnum):
    NATIVE = "native"
    SYMSTORE = "symstore"
    SYMSTORE_INDEX2 = "symstore_index2"
    SSQP = "ssqp"
    UNIFIED = "unified"
    DEBUGINFOD = "debuginfod"
    SLASHSYMBOLS = "slashsymbols"


class Casing(StrEnum):
    DEFAULT = "default"
    UPPERCASE = "uppercase"
    LOWERCASE = "lowercase"


class FileType(StrEnum):
    PE = "pe"
    PDB = "pdb"
    PORTABLEPDB = "portablepdb"
    MACH_CODE = "mach_code"
    MACH_DEBUG = "mach_debug"
    ELF_CODE = "elf_code"
    ELF_DEBUG = "elf_debug"
    WASM_CODE = "wasm_code"
    WASM_DEBUG = "wasm_debug"
    BREAKPAD = "breakpad"
    SOURCEBUNDLE = "sourcebundle"
    UUIDMAP = "uuidmap"
    BCSYMBOLMAP = "bcsymbolmap"
    IL2CPP = "il2cpp"
    PROGUARD = "proguard"
    DARTSYMBOLMAP = "dartsymbolmap"


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
        type=choice("The layout of the folder structure.", Layout, required=True),
        casing=choice("The casing of the folder structure.", Casing),
    ),
    "filters": nested(
        "Filter settings for the source.",
        filetypes=choice(
            "A list of file types that can be found on this source. If this is left empty, all file types will be enabled.",
            FileType,
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

    def __init__(self, type: SourceType, **fields: Field) -> None:
        self.type = type
        self.fields: dict[str, Field] = {**COMMON_FIELDS, **fields}

    def extend(self, **fields: Field) -> SourceKind:
        return SourceKind(self.type, **{**self.fields, **fields})

    @property
    def secrets(self) -> list[str]:
        return [name for name, field in self.fields.items() if field.secret]

    def _fields_with_type(self, fields: Mapping[str, Field]) -> dict[str, Field]:
        return {
            "type": Field({"type": "string", "enum": [self.type.value]}, required=True),
            **fields,
        }

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
    SourceType.HTTP,
    url=string("The source's URL.", required=True),
    username=string("The user name for accessing the source."),
    password=string("The password for accessing the source.", secret=True),
)

S3 = SourceKind(
    SourceType.S3,
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
    SourceType.GCS,
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
