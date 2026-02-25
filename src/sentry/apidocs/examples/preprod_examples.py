from drf_spectacular.utils import OpenApiExample


class PreprodExamples:
    EXAMPLE_SIZE_ANALYSIS_COMPLETED = {
        "buildId": "12345",
        "state": "COMPLETED",
        "appInfo": {
            "appId": "com.example.app",
            "name": "Example App",
            "version": "1.2.0",
            "buildNumber": 42,
            "artifactType": 1,
            "dateAdded": "2025-01-15T10:30:00+00:00",
            "dateBuilt": "2025-01-15T10:00:00+00:00",
        },
        "gitInfo": {
            "headSha": "abc123def456",
            "baseSha": "789xyz000111",
            "provider": "github",
            "headRepoName": "org/repo",
            "baseRepoName": "org/repo",
            "headRef": "feature-branch",
            "baseRef": "main",
            "prNumber": 42,
        },
        "downloadSize": 5120000,
        "installSize": 10240000,
        "analysisDuration": 3.5,
        "analysisVersion": "1.0.0",
        "insights": None,
        "appComponents": None,
        "baseBuildId": None,
        "baseAppInfo": None,
        "comparisons": None,
    }

    GET_SIZE_ANALYSIS = [
        OpenApiExample(
            "Completed Size Analysis",
            value=EXAMPLE_SIZE_ANALYSIS_COMPLETED,
            status_codes=["200"],
            response_only=True,
        ),
    ]
