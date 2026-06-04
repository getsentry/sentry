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

    EXAMPLE_INSTALL_INFO_INSTALLABLE = {
        "buildId": "12345",
        "state": "PROCESSED",
        "appInfo": _APP_INFO,
        "gitInfo": _GIT_INFO,
        "platform": "ANDROID",
        "projectId": "1",
        "projectSlug": "my-project",
        "buildConfiguration": "release",
        "isInstallable": True,
        "installUrl": "https://sentry.io/api/0/projects/org/project/files/installablepreprodartifact/abc123/?response_format=apk",
        "installUrlExpiresAt": "2025-01-15T22:30:00+00:00",
        "downloadCount": 5,
        "releaseNotes": "Bug fixes and performance improvements.",
        "installGroups": ["beta-testers"],
        "isCodeSignatureValid": None,
        "profileName": None,
        "codesigningType": None,
    }

    EXAMPLE_INSTALL_INFO_NOT_INSTALLABLE = {
        "buildId": "12345",
        "state": "PROCESSED",
        "appInfo": _APP_INFO,
        "gitInfo": None,
        "platform": "ANDROID",
        "projectId": "1",
        "projectSlug": "my-project",
        "buildConfiguration": None,
        "isInstallable": False,
        "installUrl": None,
        "installUrlExpiresAt": None,
        "downloadCount": 0,
        "releaseNotes": None,
        "installGroups": None,
        "isCodeSignatureValid": None,
        "profileName": None,
        "codesigningType": None,
    }

    EXAMPLE_INSTALL_INFO_APPLE = {
        "buildId": "12346",
        "state": "PROCESSED",
        "appInfo": {
            **_APP_INFO,
            "artifactType": "XCARCHIVE",
        },
        "gitInfo": _GIT_INFO,
        "platform": "APPLE",
        "projectId": "1",
        "projectSlug": "my-project",
        "buildConfiguration": "release",
        "isInstallable": True,
        "installUrl": "https://sentry.io/api/0/projects/org/project/files/installablepreprodartifact/abc123/?response_format=plist",
        "installUrlExpiresAt": "2025-01-15T22:30:00+00:00",
        "downloadCount": 3,
        "releaseNotes": None,
        "installGroups": None,
        "isCodeSignatureValid": True,
        "profileName": "iOS Team Provisioning Profile",
        "codesigningType": "development",
    }

    GET_INSTALL_INFO = [
        OpenApiExample(
            "Installable Artifact",
            value=EXAMPLE_INSTALL_INFO_INSTALLABLE,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Non-Installable Artifact",
            value=EXAMPLE_INSTALL_INFO_NOT_INSTALLABLE,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Apple Artifact with Code Signing",
            value=EXAMPLE_INSTALL_INFO_APPLE,
            status_codes=["200"],
            response_only=True,
        ),
    ]

    EXAMPLE_BUILD_SUMMARY = {
        "buildId": "12345",
        "state": "PROCESSED",
        "appInfo": _APP_INFO,
        "gitInfo": _GIT_INFO,
        "platform": "ANDROID",
        "projectId": "1",
        "projectSlug": "my-project",
        "buildConfiguration": "release",
        "isInstallable": True,
        "installUrl": "https://sentry.io/api/0/projects/org/project/files/installablepreprodartifact/abc123/?response_format=apk",
        "installUrlExpiresAt": "2025-01-15T22:30:00+00:00",
        "downloadCount": 5,
        "releaseNotes": "Bug fixes and performance improvements.",
        "installGroups": ["beta-testers"],
        "isCodeSignatureValid": None,
        "profileName": None,
        "codesigningType": None,
    }

    EXAMPLE_LATEST_BUILD_ONLY = {
        "latestArtifact": EXAMPLE_BUILD_SUMMARY,
        "currentArtifact": None,
    }

    EXAMPLE_UPDATE_AVAILABLE = {
        "latestArtifact": {
            **EXAMPLE_BUILD_SUMMARY,
            "buildId": "12346",
            "appInfo": {**_APP_INFO, "version": "1.3.0", "buildNumber": 50},
        },
        "currentArtifact": EXAMPLE_BUILD_SUMMARY,
    }

    EXAMPLE_NO_UPDATE = {
        "latestArtifact": EXAMPLE_BUILD_SUMMARY,
        "currentArtifact": EXAMPLE_BUILD_SUMMARY,
    }

    EXAMPLE_SIZE_STATUS_CHECK_RULES = {
        "enabled": True,
        "rules": [
            {
                "id": "rule-1",
                "metric": "install_size",
                "measurement": "absolute_diff",
                "value": "5000000",
                "filterQuery": "app_id:com.example.app platform_name:apple build_configuration_name:Release",
                "filters": [
                    {
                        "key": "app_id",
                        "conditions": [{"operator": "equals", "values": ["com.example.app"]}],
                    },
                    {
                        "key": "platform_name",
                        "conditions": [{"operator": "equals", "values": ["apple"]}],
                    },
                    {
                        "key": "build_configuration_name",
                        "conditions": [{"operator": "equals", "values": ["Release"]}],
                    },
                ],
                "artifactType": "main_artifact",
            }
        ],
    }

    EXAMPLE_SNAPSHOT_STATUS_CHECK_RULES = {
        "enabled": True,
        "rules": {
            "failOnAdded": False,
            "failOnRemoved": True,
            "failOnChanged": True,
            "failOnRenamed": False,
        },
    }

    GET_LATEST_BUILD = [
        OpenApiExample(
            "Latest Build Only",
            value=EXAMPLE_LATEST_BUILD_ONLY,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Update Available",
            value=EXAMPLE_UPDATE_AVAILABLE,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "No Update Available",
            value=EXAMPLE_NO_UPDATE,
            status_codes=["200"],
            response_only=True,
        ),
    ]

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

    GET_SIZE_STATUS_CHECK_RULES = [
        OpenApiExample(
            "Configured Size Analysis Status Check Rules",
            value=EXAMPLE_SIZE_STATUS_CHECK_RULES,
            status_codes=["200"],
            response_only=True,
        ),
    ]

    GET_SNAPSHOT_STATUS_CHECK_RULES = [
        OpenApiExample(
            "Configured Snapshot Status Check Rules",
            value=EXAMPLE_SNAPSHOT_STATUS_CHECK_RULES,
            status_codes=["200"],
            response_only=True,
        ),
    ]

    _SNAPSHOT_VCS_INFO = {
        "head_sha": "abc123def456",
        "base_sha": "789xyz000111",
        "provider": "github",
        "head_repo_name": "org/repo",
        "base_repo_name": "org/repo",
        "head_ref": "feature-branch",
        "base_ref": "main",
        "pr_number": 42,
    }

    _SNAPSHOT_IMAGE = {
        "key": "a1b2c3d4e5f6",
        "display_name": "Home Screen",
        "group": "iPhone 15",
        "image_file_name": "home_screen_iphone15.png",
        "width": 1170,
        "height": 2532,
    }

    EXAMPLE_SNAPSHOT_DETAILS_DIFF = {
        "head_artifact_id": "100",
        "base_artifact_id": "99",
        "project_id": "1",
        "comparison_type": "diff",
        "state": "UPLOADED",
        "vcs_info": _SNAPSHOT_VCS_INFO,
        "app_id": "com.example.app",
        "is_selective": False,
        "images": [_SNAPSHOT_IMAGE],
        "image_count": 1,
        "added": [],
        "added_count": 0,
        "removed": [],
        "removed_count": 0,
        "renamed": [],
        "renamed_count": 0,
        "changed": [
            {
                "base_image": {**_SNAPSHOT_IMAGE, "key": "old_hash_123"},
                "head_image": _SNAPSHOT_IMAGE,
                "diff_image_key": "diff_hash_456",
                "diff": 0.02,
            }
        ],
        "changed_count": 1,
        "unchanged": [],
        "unchanged_count": 0,
        "errored": [],
        "errored_count": 0,
        "skipped": [],
        "skipped_count": 0,
        "diff_threshold": 0.01,
        "comparison_state": "success",
        "approval_status": "requires_approval",
        "comparison_error_message": None,
        "approvers": [],
    }

    EXAMPLE_SNAPSHOT_DETAILS_SOLO = {
        "head_artifact_id": "100",
        "base_artifact_id": None,
        "project_id": "1",
        "comparison_type": "solo",
        "state": "UPLOADED",
        "vcs_info": {
            "head_sha": "abc123def456",
            "base_sha": None,
            "provider": "github",
            "head_repo_name": "org/repo",
            "base_repo_name": None,
            "head_ref": "main",
            "base_ref": None,
            "pr_number": None,
        },
        "app_id": "com.example.app",
        "is_selective": False,
        "images": [_SNAPSHOT_IMAGE],
        "image_count": 1,
        "added": [],
        "added_count": 0,
        "removed": [],
        "removed_count": 0,
        "renamed": [],
        "renamed_count": 0,
        "changed": [],
        "changed_count": 0,
        "unchanged": [],
        "unchanged_count": 0,
        "errored": [],
        "errored_count": 0,
        "skipped": [],
        "skipped_count": 0,
        "diff_threshold": 0.01,
        "comparison_state": None,
        "approval_status": None,
        "comparison_error_message": None,
        "approvers": [],
    }

    GET_SNAPSHOT_DETAILS = [
        OpenApiExample(
            "Snapshot with Comparison (Diff)",
            value=EXAMPLE_SNAPSHOT_DETAILS_DIFF,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Snapshot without Comparison (Solo)",
            value=EXAMPLE_SNAPSHOT_DETAILS_SOLO,
            status_codes=["200"],
            response_only=True,
        ),
    ]

    EXAMPLE_SNAPSHOT_CREATED = {
        "artifactId": "100",
        "snapshotMetricsId": "200",
        "imageCount": 5,
        "snapshotUrl": "https://sentry.io/organizations/org/preprod/snapshots/100/",
    }

    CREATE_SNAPSHOT = [
        OpenApiExample(
            "Snapshot Created",
            value=EXAMPLE_SNAPSHOT_CREATED,
            status_codes=["200"],
            response_only=True,
        ),
    ]

    EXAMPLE_SNAPSHOT_IMAGE_DETAIL_CHANGED = {
        "image_file_name": "home_screen_iphone15.png",
        "comparison_status": "changed",
        "head_image": {
            "content_hash": "a1b2c3d4e5f6",
            "display_name": "Home Screen",
            "group": "iPhone 15",
            "image_file_name": "home_screen_iphone15.png",
            "width": 1170,
            "height": 2532,
            "diff_threshold": 0.01,
            "description": None,
            "tags": None,
            "image_url": "/api/0/projects/org-slug/project-slug/files/images/a1b2c3d4e5f6/",
        },
        "base_image": {
            "content_hash": "old_hash_123",
            "display_name": "Home Screen",
            "group": "iPhone 15",
            "image_file_name": "home_screen_iphone15.png",
            "width": 1170,
            "height": 2532,
            "diff_threshold": 0.01,
            "description": None,
            "tags": None,
            "image_url": "/api/0/projects/org-slug/project-slug/files/images/old_hash_123/",
        },
        "diff_image_url": "/api/0/projects/org-slug/project-slug/files/images/diff_hash_456/",
        "diff_percentage": 0.02,
        "previous_image_file_name": None,
    }

    EXAMPLE_SNAPSHOT_IMAGE_DETAIL_ADDED = {
        "image_file_name": "new_screen.png",
        "comparison_status": "added",
        "head_image": {
            "content_hash": "new_hash_789",
            "display_name": "New Screen",
            "group": "iPhone 15",
            "image_file_name": "new_screen.png",
            "width": 1170,
            "height": 2532,
            "diff_threshold": None,
            "description": None,
            "tags": None,
            "image_url": "/api/0/projects/org-slug/project-slug/files/images/new_hash_789/",
        },
        "base_image": None,
        "diff_image_url": None,
        "diff_percentage": None,
        "previous_image_file_name": None,
    }

    GET_SNAPSHOT_IMAGE_DETAIL = [
        OpenApiExample(
            "Changed Image",
            value=EXAMPLE_SNAPSHOT_IMAGE_DETAIL_CHANGED,
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Added Image",
            value=EXAMPLE_SNAPSHOT_IMAGE_DETAIL_ADDED,
            status_codes=["200"],
            response_only=True,
        ),
    ]

    EXAMPLE_LATEST_BASE_SNAPSHOT = {
        "head_artifact_id": "99",
        "project_id": "1",
        "project_slug": "my-project",
        "app_id": "com.example.app",
        "image_count": 2,
        "images": [
            {
                "key": "a1b2c3d4e5f6",
                "display_name": "Home Screen",
                "group": "iPhone 15",
                "image_file_name": "home_screen_iphone15.png",
                "width": 1170,
                "height": 2532,
                "image_url": "/api/0/projects/org-slug/my-project/files/images/a1b2c3d4e5f6/",
            },
        ],
        "diff_threshold": 0.01,
        "date_added": "2025-01-15T10:30:00+00:00",
        "vcs_info": {
            "head_sha": "abc123def456",
            "base_sha": None,
            "head_ref": "main",
            "base_ref": None,
            "head_repo_name": "org/repo",
            "pr_number": None,
        },
    }

    GET_LATEST_BASE_SNAPSHOT = [
        OpenApiExample(
            "Latest Base Snapshot",
            value=EXAMPLE_LATEST_BASE_SNAPSHOT,
            status_codes=["200"],
            response_only=True,
        ),
    ]
