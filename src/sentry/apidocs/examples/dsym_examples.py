from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.serializers.models.debug_file import DebugFileSerializerResponse

PROGUARD_DIF: DebugFileSerializerResponse = {
    "id": "1066716922",
    "uuid": "d8f92f82-3dbc-4fbb-ae68-69e881a9becc",
    "debugId": "d8f92f82-3dbc-4fbb-ae68-69e881a9becc",
    "codeId": None,
    "cpuName": "any",
    "objectName": "proguard-mapping",
    "symbolType": "proguard",
    "headers": {"Content-Type": "text/x-proguard+plain"},
    "size": 12868987,
    "storage_path": None,
    "sha1": "c31bcca43ff75e8c94c336e647d518fb05dcf658",
    "dateCreated": datetime.fromisoformat("2026-03-24T23:31:18.583107Z"),
    "data": {"features": ["mapping"]},
}

ELF_DIF: DebugFileSerializerResponse = {
    "id": "1066716918",
    "uuid": "d50e6bca-81a4-662b-8461-e1c5e27f157b",
    "debugId": "d50e6bca-81a4-662b-8461-e1c5e27f157b",
    "codeId": "ca6b0ed5a4812b668461e1c5e27f157b8422d5bd",
    "cpuName": "arm64",
    "objectName": "libxamarin-app.dbg.so",
    "symbolType": "elf",
    "headers": {"Content-Type": "application/x-elf-binary"},
    "size": 41584,
    "storage_path": None,
    "sha1": "ac40db6f7fff550f82c63242f618e2d3987cc3c7",
    "dateCreated": datetime.fromisoformat("2026-03-24T23:31:18.465820Z"),
    "data": {"type": "dbg", "features": ["symtab"]},
}


class DebugFileExamples:
    LIST_PROJECT_DEBUG_FILES = [
        OpenApiExample(
            "Return a list of debug information files for a project",
            value=[PROGUARD_DIF, ELF_DIF],
            response_only=True,
            status_codes=["200"],
        )
    ]
