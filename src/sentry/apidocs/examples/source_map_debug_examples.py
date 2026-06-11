from drf_spectacular.utils import OpenApiExample

SOURCE_MAP_DEBUG = {
    "dist": "1.0.0",
    "release": "frontend@1.0.0",
    "exceptions": [
        {
            "frames": [
                {
                    "debug_id_process": {
                        "debug_id": "f206e0e7-3d0c-41cb-bccc-11b716728e27",
                        "uploaded_source_file_with_correct_debug_id": True,
                        "uploaded_source_map_with_correct_debug_id": True,
                    },
                    "release_process": {
                        "abs_path": "https://example.com/static/js/main.js",
                        "matching_source_file_names": ["~/static/js/main.js"],
                        "matching_source_map_name": "~/static/js/main.js.map",
                        "source_map_reference": "main.js.map",
                        "source_file_lookup_result": "found",
                        "source_map_lookup_result": "found",
                    },
                    "scraping_process": {
                        "source_file": {
                            "url": "https://example.com/static/js/main.js",
                            "status": "success",
                        },
                        "source_map": {
                            "url": "https://example.com/static/js/main.js.map",
                            "status": "success",
                        },
                    },
                }
            ]
        }
    ],
    "has_debug_ids": True,
    "min_debug_id_sdk_version": "7.56.0",
    "sdk_version": "7.60.0",
    "project_has_some_artifact_bundle": True,
    "release_has_some_artifact": True,
    "has_uploaded_some_artifact_with_a_debug_id": True,
    "sdk_debug_id_support": "full",
    "has_scraping_data": True,
}


class SourceMapDebugExamples:
    GET_SOURCE_MAP_DEBUG = [
        OpenApiExample(
            "Source map debug information for an event",
            value=SOURCE_MAP_DEBUG,
            response_only=True,
            status_codes=["200"],
        )
    ]
