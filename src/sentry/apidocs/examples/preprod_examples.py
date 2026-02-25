from drf_spectacular.utils import OpenApiExample

_APP_INFO = {
    "appId": "com.example.app",
    "name": "Example App",
    "version": "1.2.0",
    "buildNumber": 42,
    "artifactType": "AAB",
    "dateAdded": "2025-01-15T10:30:00+00:00",
    "dateBuilt": "2025-01-15T10:00:00+00:00",
}

_GIT_INFO = {
    "headSha": "abc123def456",
    "baseSha": "789xyz000111",
    "provider": "github",
    "headRepoName": "org/repo",
    "baseRepoName": "org/repo",
    "headRef": "feature-branch",
    "baseRef": "main",
    "prNumber": 42,
}

_BASE_RESPONSE = {
    "buildId": "12345",
    "appInfo": _APP_INFO,
    "gitInfo": _GIT_INFO,
    "errorCode": None,
    "errorMessage": None,
    "downloadSize": None,
    "installSize": None,
    "analysisDuration": None,
    "analysisVersion": None,
    "insights": None,
    "appComponents": None,
    "baseBuildId": None,
    "baseAppInfo": None,
    "comparisons": None,
}


class PreprodExamples:
    EXAMPLE_SIZE_ANALYSIS_PENDING = {
        **_BASE_RESPONSE,
        "state": "PENDING",
    }

    EXAMPLE_SIZE_ANALYSIS_FAILED = {
        **_BASE_RESPONSE,
        "state": "FAILED",
        "errorCode": "TIMEOUT",
        "errorMessage": "Failed to analyze artifact: unsupported format",
    }

    EXAMPLE_SIZE_ANALYSIS_COMPLETED = {
        **_BASE_RESPONSE,
        "state": "COMPLETED",
        "downloadSize": 5120000,
        "installSize": 10240000,
        "analysisDuration": 3.5,
        "analysisVersion": "1.0.0",
    }

    EXAMPLE_SIZE_ANALYSIS_COMPLETED_WITH_COMPARISON = {
        **_BASE_RESPONSE,
        "state": "COMPLETED",
        "downloadSize": 5120000,
        "installSize": 10240000,
        "analysisDuration": 3.5,
        "analysisVersion": "1.0.0",
        "baseBuildId": "12344",
        "baseAppInfo": {
            **_APP_INFO,
            "version": "1.1.0",
            "buildNumber": 41,
        },
        "comparisons": [
            {
                "metricsArtifactType": "MAIN_ARTIFACT",
                "identifier": None,
                "state": "SUCCESS",
                "errorCode": None,
                "errorMessage": None,
                "diffItems": [
                    {
                        "sizeDiff": 1024,
                        "headSize": 5120,
                        "baseSize": 4096,
                        "path": "lib/armeabi-v7a/libnative.so",
                        "itemType": "native_library",
                        "type": "modified",
                        "diffItems": None,
                    }
                ],
                "insightDiffItems": None,
                "sizeMetricDiff": {
                    "metricsArtifactType": "MAIN_ARTIFACT",
                    "identifier": None,
                    "headInstallSize": 10240000,
                    "headDownloadSize": 5120000,
                    "baseInstallSize": 9800000,
                    "baseDownloadSize": 4900000,
                },
            }
        ],
    }

    GET_SIZE_ANALYSIS = [
        OpenApiExample(
            "Pending Analysis",
            value=EXAMPLE_SIZE_ANALYSIS_PENDING,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Failed Analysis",
            value=EXAMPLE_SIZE_ANALYSIS_FAILED,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Completed Analysis",
            value=EXAMPLE_SIZE_ANALYSIS_COMPLETED,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Completed Analysis with Comparison",
            value=EXAMPLE_SIZE_ANALYSIS_COMPLETED_WITH_COMPARISON,
            status_codes=["200"],
            response_only=True,
        ),
    ]
