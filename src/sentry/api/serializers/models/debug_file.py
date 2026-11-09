from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, NotRequired, TypedDict, cast

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.debugfile import ProjectDebugFile


class DebugFileData(TypedDict):
    """`ProjectDebugFile.data`, as `DifMeta` and the proguard and dartsymbolmap uploads set it."""

    type: NotRequired[
        Annotated[
            str,
            ApiDescription(
                "Kind of the object, such as executable, debug companion or library. Left out "
                "for mapping files"
            ),
        ]
    ]
    features: NotRequired[
        Annotated[
            list[str],
            ApiDescription(
                "Debug features the file provides, such as symtab, debug, unwind, sources or mapping"
            ),
        ]
    ]


class DebugFileSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the debug file")]
    uuid: Annotated[str, ApiDescription("Debug ID without the age suffix, as a UUID")]
    debugId: Annotated[str, ApiDescription("Debug ID of the file")]
    codeId: Annotated[
        str | None,
        ApiDescription(
            "Code ID of the file, such as the GNU build ID. Null when the file has none"
        ),
    ]
    cpuName: Annotated[str, ApiDescription("CPU architecture of the file, such as x86_64 or arm64")]
    objectName: Annotated[str, ApiDescription("Name of the object file")]
    symbolType: Annotated[
        str, ApiDescription("Format of the file, such as macho, elf, pe, pdb, breakpad or proguard")
    ]
    headers: Annotated[
        dict[str, str],
        ApiDescription("HTTP headers to download the file with, such as Content-Type"),
    ]
    size: Annotated[int, ApiDescription("Size of the file in bytes")]
    sha1: Annotated[str, ApiDescription("SHA-1 checksum of the file")]
    dateCreated: Annotated[datetime, ApiDescription("When the file was uploaded (ISO 8601)")]
    data: Annotated[
        DebugFileData,
        ApiDescription("Extra data about the file, such as its features. Empty when not known"),
    ]


@register(ProjectDebugFile)
class DebugFileSerializer(Serializer[DebugFileSerializerResponse]):
    def serialize(
        self,
        obj: ProjectDebugFile,
        attrs: Mapping[object, object],
        user: object,
        **kwargs: object,
    ) -> DebugFileSerializerResponse:
        headers = {"Content-Type": obj.get_content_type()}

        return {
            "id": str(obj.id),
            "uuid": obj.debug_id[:36],
            "debugId": obj.debug_id,
            "codeId": obj.code_id,
            "cpuName": obj.cpu_name,
            "objectName": obj.object_name,
            "symbolType": obj.file_format,
            "headers": headers,
            "size": obj.get_file_size(),
            "sha1": obj.get_checksum(),
            "dateCreated": obj.get_date_created(),
            "data": cast(DebugFileData, obj.data or {}),
        }
