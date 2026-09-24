"""
The kinds of symbol source a project can configure.

Each kind is a serializer. It validates sources on their way into the project
option and it documents the API, so the two cannot drift apart. `SecretField`
marks the credentials that API responses hide.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from rest_framework import serializers


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


HIDDEN_SECRET = {"hidden-secret": True}


def is_internal_source_id(source_id: str) -> bool:
    """Whether a source ID is reserved for Sentry's own sources."""
    return source_id.startswith("sentry")


class SecretField(serializers.CharField):
    """A credential. API responses replace its value by `HIDDEN_SECRET`."""


class StrictSerializer(serializers.Serializer):
    """A serializer that rejects fields it does not declare."""

    def to_internal_value(self, data: Any) -> Any:
        if isinstance(data, dict) and (unknown := sorted(set(data) - set(self.fields))):
            raise serializers.ValidationError({field: ["Unknown field."] for field in unknown})
        return super().to_internal_value(data)


class LayoutSerializer(StrictSerializer):
    type = serializers.ChoiceField(
        choices=list(Layout), help_text="The layout of the folder structure."
    )
    casing = serializers.ChoiceField(
        choices=list(Casing), required=False, help_text="The casing of the folder structure."
    )


class FiltersSerializer(StrictSerializer):
    filetypes = serializers.MultipleChoiceField(
        choices=list(FileType),
        required=False,
        help_text="A list of file types that can be found on this source. If this is left empty, all file types will be enabled.",
    )
    path_patterns = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="A list of glob patterns to check against the debug and code file paths of debug files. Only files that match one of these patterns will be requested from the source. If this is left empty, no path-based filtering takes place.",
    )
    requires_checksum = serializers.BooleanField(
        required=False,
        help_text="Whether this source requires a debug checksum to be sent with each request. Defaults to `false`.",
    )


class SymbolSourceSerializer(StrictSerializer):
    """The fields every kind of source has. A kind adds its own on top."""

    id = serializers.CharField(
        required=False,
        min_length=1,
        help_text="The internal ID of the source. Must be distinct from all other source IDs and cannot start with `sentry:`. If this is not provided, a new UUID will be generated.",
    )
    name = serializers.CharField(
        required=False, allow_blank=True, help_text="The human-readable name of the source."
    )
    layout = LayoutSerializer(help_text="Layout settings for the source.")
    filters = FiltersSerializer(required=False, help_text="Filter settings for the source.")
    # Set on builtin sources in settings. Stored custom sources may carry them
    # too, so they stay accepted. Without help text they stay out of the API docs.
    is_public = serializers.BooleanField(required=False)
    has_index = serializers.BooleanField(required=False)
    platforms = serializers.ListField(child=serializers.CharField(), required=False)


class HttpSourceSerializer(SymbolSourceSerializer):
    type = serializers.ChoiceField(choices=[SourceType.HTTP])
    url = serializers.CharField(help_text="The source's URL.")
    username = serializers.CharField(
        required=False, allow_blank=True, help_text="The user name for accessing the source."
    )
    password = SecretField(
        required=False, allow_blank=True, help_text="The password for accessing the source."
    )


class S3SourceSerializer(SymbolSourceSerializer):
    type = serializers.ChoiceField(choices=[SourceType.S3])
    bucket = serializers.CharField(help_text="The bucket where the source resides.")
    region = serializers.CharField(
        help_text="The source's [S3 region](https://docs.aws.amazon.com/general/latest/gr/s3.html)."
    )
    access_key = serializers.CharField(
        help_text="The [AWS Access Key](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html#access-keys-and-secret-access-keys)."
    )
    secret_key = SecretField(
        help_text="The [AWS Secret Access Key](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html#access-keys-and-secret-access-keys)."
    )
    prefix = serializers.CharField(
        required=False, allow_blank=True, help_text="The path prefix inside the bucket."
    )


class GcsSourceSerializer(SymbolSourceSerializer):
    type = serializers.ChoiceField(choices=[SourceType.GCS])
    bucket = serializers.CharField(help_text="The bucket where the source resides.")
    client_email = serializers.CharField(help_text="The GCS email address for authentication.")
    private_key = SecretField(help_text="The GCS private key.")
    prefix = serializers.CharField(
        required=False, allow_blank=True, help_text="The path prefix inside the bucket."
    )


class BuiltinHttpSourceSerializer(HttpSourceSerializer):
    """Builtin HTTP sources from settings may carry headers. The API does not expose that."""

    headers = serializers.DictField(child=serializers.CharField(), required=False)
    accept_invalid_certs = serializers.BooleanField(required=False)


SOURCE_SERIALIZERS: dict[str, type[SymbolSourceSerializer]] = {
    SourceType.HTTP: HttpSourceSerializer,
    SourceType.S3: S3SourceSerializer,
    SourceType.GCS: GcsSourceSerializer,
}

BUILTIN_SOURCE_SERIALIZERS = {**SOURCE_SERIALIZERS, SourceType.HTTP: BuiltinHttpSourceSerializer}


def secret_fields(serializer_class: type[serializers.Serializer]) -> list[str]:
    return [
        name for name, field in serializer_class().fields.items() if isinstance(field, SecretField)
    ]


SECRET_FIELDS = frozenset(
    name
    for serializer_class in SOURCE_SERIALIZERS.values()
    for name in secret_fields(serializer_class)
)
