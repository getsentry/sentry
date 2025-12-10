# EAP Preprod Trace Item Attributes

This document lists all attributes available when querying `TRACE_ITEM_TYPE_PREPROD` trace items in EAP.

## Trace ID Design

**Trace ID = `{artifact_id:032x}` (32-character hex string)**

Each `PreprodArtifact` gets its own trace. This groups related components of the same build:
- Main app size metrics
- Watch app size metrics (iOS)
- Dynamic feature size metrics (Android)

The trace ID is a 32-character hexadecimal string (OpenTelemetry format) derived from the preprod_artifact_id.

We don't use `git_head_sha` as the trace ID because multiple unrelated apps could be uploaded to the same commit (monorepo scenario). Instead, `git_head_sha` is available as a filterable attribute.

## Size Metric Attributes (from PreprodArtifactSizeMetrics)

| Attribute | Type | Description | Always Present |
|-----------|------|-------------|----------------|
| `preprod_artifact_id` | int | ID of the PreprodArtifact | ✅ |
| `size_metric_id` | int | ID of the PreprodArtifactSizeMetrics | ✅ |
| `metrics_artifact_type` | int | Type: 0=MAIN_ARTIFACT, 1=WATCH_ARTIFACT, 2=ANDROID_DYNAMIC_FEATURE | ✅ |
| `identifier` | string | Component identifier (e.g., dynamic feature app ID) | Optional |
| `min_install_size` | int | Minimum install size in bytes | Optional |
| `max_install_size` | int | Maximum install size in bytes | Optional |
| `min_download_size` | int | Minimum download size in bytes | Optional |
| `max_download_size` | int | Maximum download size in bytes | Optional |
| `processing_version` | string | Version of size analysis processor | Optional |
| `analysis_file_id` | int | File ID of the analysis results | Optional |

**Note:** `size_metric_state` is NOT included because EAP writes only occur after successful completion (state=COMPLETED), making it redundant in append-only storage.

## Artifact Attributes (from PreprodArtifact)

| Attribute | Type | Description | Always Present |
|-----------|------|-------------|----------------|
| `artifact_state` | int | State at write time: 0=UPLOADING, 1=UPLOADED, 3=PROCESSED, 4=FAILED | ✅ |
| `artifact_type` | int | Type: 0=XCARCHIVE (iOS), 1=AAB (Android), 2=APK (Android) | Optional |
| `app_id` | string | App bundle identifier (e.g., "com.example.app") | Optional |
| `app_name` | string | Human-readable app name (e.g., "My App") | Optional |
| `build_version` | string | Build version string (e.g., "1.2.3") | Optional |
| `build_number` | int | Build number (e.g., 100) | Optional |
| `main_binary_identifier` | string | Identifier of the main binary | Optional |
| `artifact_date_built` | int | Unix timestamp when artifact was built | Optional |

**Note:** `artifact_state` is a point-in-time snapshot when the size metrics completed. In EAP's append-only storage, this won't update if the artifact state changes later.

## Build Configuration Attributes (from PreprodBuildConfiguration)

| Attribute | Type | Description | Always Present |
|-----------|------|-------------|----------------|
| `build_configuration_name` | string | Build config name (e.g., "Debug", "Release") | Optional |

## Git Attributes (from CommitComparison)

| Attribute | Type | Description | Always Present |
|-----------|------|-------------|----------------|
| `git_head_sha` | string | HEAD commit SHA | Optional* |
| `git_base_sha` | string | Base commit SHA (merge-base) | Optional |
| `git_provider` | string | Git provider (e.g., "github", "gitlab") | Optional |
| `git_head_repo_name` | string | Head repository (e.g., "owner/repo") | Optional |
| `git_base_repo_name` | string | Base repository (for forks) | Optional |
| `git_head_ref` | string | Head branch/ref (e.g., "feature/xyz") | Optional |
| `git_base_ref` | string | Base branch/ref (e.g., "main") | Optional |
| `git_pr_number` | int | Pull request number | Optional |

\* `git_head_sha` will be present if a CommitComparison exists for the artifact

## Example Queries

### Query all iOS Release builds
```python
trace_item_type = "preprod"
filters = [
    "artifact_type = 0",  # XCARCHIVE (iOS)
    "build_configuration_name = 'Release'"
]
```

### Query size metrics for a specific PR
```python
trace_item_type = "preprod"
filters = ["git_pr_number = 42"]
```

### Query size metrics for a specific app
```python
trace_item_type = "preprod"
filters = ["app_id = 'com.example.app'"]
```

### Find large builds
```python
trace_item_type = "preprod"
filters = ["max_install_size > 100000000"]  # > 100MB
```

### Compare Debug vs Release builds
```python
trace_item_type = "preprod"
group_by = ["build_configuration_name"]
aggregate = ["avg(max_install_size)"]
```
