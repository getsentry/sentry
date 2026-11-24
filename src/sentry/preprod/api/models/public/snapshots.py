from __future__ import annotations

from typing import Annotated, Literal, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import GitRef, IsoDateTime, Url


class VcsInfoResponseDict(TypedDict, total=False):
    head_sha: Annotated[str | None, ApiDescription("Commit SHA of the build")]
    base_sha: Annotated[
        str | None, ApiDescription("Commit SHA of the base the build is compared against")
    ]
    provider: Annotated[str | None, ApiDescription("Version control provider, such as github")]
    head_repo_name: Annotated[str | None, ApiDescription("Repository name of the head commit")]
    base_repo_name: Annotated[str | None, ApiDescription("Repository name of the base commit")]
    head_ref: Annotated[GitRef | None, ApiDescription("Branch or ref of the head commit")]
    base_ref: Annotated[GitRef | None, ApiDescription("Branch or ref of the base commit")]
    pr_number: Annotated[int | None, ApiDescription("Pull request number")]


class SnapshotImageResponseDict(TypedDict, total=False):
    key: Annotated[str, ApiDescription("Content hash of the image")]
    display_name: Annotated[str | None, ApiDescription("Display name of the image")]
    group: Annotated[str | None, ApiDescription("Group the image belongs to")]
    image_file_name: Annotated[
        str, ApiDescription("File name of the image, which identifies it within the snapshot")
    ]
    width: Annotated[int, ApiDescription("Width of the image in pixels")]
    height: Annotated[int, ApiDescription("Height of the image in pixels")]
    canvas_theme: Annotated[
        Literal["light", "dark"] | None,
        ApiDescription("Theme the image was rendered with: light or dark"),
    ]


class SnapshotDiffPairResponseDict(TypedDict, total=False):
    base_image: Annotated[SnapshotImageResponseDict, ApiDescription("Image from the base snapshot")]
    head_image: Annotated[SnapshotImageResponseDict, ApiDescription("Image from the head snapshot")]
    diff_image_key: Annotated[
        str | None,
        ApiDescription(
            "ID of the diff mask image highlighting changed pixels. Only set for changed images"
        ),
    ]
    diff: Annotated[
        float | None,
        ApiDescription("Fraction of pixels that changed, from 0 to 1. Only set for changed images"),
    ]


class SnapshotApproverResponseDict(TypedDict, total=False):
    id: Annotated[
        str | None, ApiDescription("Sentry user ID, or GitHub user ID for approvals from GitHub")
    ]
    name: Annotated[
        str | None,
        ApiDescription("Display name of the approver, or GitHub login for approvals from GitHub"),
    ]
    email: Annotated[
        str | None, ApiDescription("Email address of the approver. Only set for Sentry users")
    ]
    username: Annotated[
        str | None,
        ApiDescription("Username of the approver, or GitHub login for approvals from GitHub"),
    ]
    avatar_url: Annotated[
        Url | None, ApiDescription("Avatar URL of the approver. Only set for approvals from GitHub")
    ]
    approved_at: Annotated[
        IsoDateTime | None, ApiDescription("When the approval was given (ISO 8601)")
    ]
    source: Annotated[
        Literal["sentry", "github"],
        ApiDescription("Where the approval was given: sentry or github"),
    ]


class SnapshotDetailsResponseDict(TypedDict, total=False):
    head_artifact_id: Annotated[str, ApiDescription("ID of the build the snapshot belongs to")]
    base_artifact_id: Annotated[
        str | None, ApiDescription("ID of the base build the snapshot is compared against")
    ]
    project_id: Annotated[str, ApiDescription("ID of the project")]
    comparison_type: Annotated[
        str,
        ApiDescription(
            "How the snapshot is compared: diff when a comparison exists, waiting_for_base when the build has a base commit but no comparison yet, or solo otherwise"
        ),
    ]
    state: Annotated[
        str, ApiDescription("State of the build: UPLOADING, UPLOADED, PROCESSED or FAILED")
    ]
    vcs_info: Annotated[VcsInfoResponseDict, ApiDescription("Version control details of the build")]
    app_id: Annotated[str | None, ApiDescription("App identifier of the build")]
    is_selective: Annotated[
        bool, ApiDescription("Whether the upload contained only a subset of the app's images")
    ]
    images: Annotated[
        list[SnapshotImageResponseDict],
        ApiDescription("All images in the snapshot. Empty when comparison_type is diff"),
    ]
    image_count: Annotated[int, ApiDescription("Number of images in the snapshot")]
    added: Annotated[
        list[SnapshotImageResponseDict],
        ApiDescription("Images in the head snapshot but not the base"),
    ]
    added_count: Annotated[int, ApiDescription("Number of added images")]
    removed: Annotated[
        list[SnapshotImageResponseDict],
        ApiDescription("Images in the base snapshot but not the head"),
    ]
    removed_count: Annotated[int, ApiDescription("Number of removed images")]
    renamed: Annotated[
        list[SnapshotDiffPairResponseDict],
        ApiDescription("Images whose file name changed but whose content didn't"),
    ]
    renamed_count: Annotated[int, ApiDescription("Number of renamed images")]
    changed: Annotated[
        list[SnapshotDiffPairResponseDict],
        ApiDescription(
            "Images whose changed pixels exceed the diff threshold, sorted by most changed first"
        ),
    ]
    changed_count: Annotated[int, ApiDescription("Number of changed images")]
    unchanged: Annotated[
        list[SnapshotImageResponseDict], ApiDescription("Images that match the base snapshot")
    ]
    unchanged_count: Annotated[int, ApiDescription("Number of unchanged images")]
    errored: Annotated[
        list[SnapshotDiffPairResponseDict], ApiDescription("Images that couldn't be compared")
    ]
    errored_count: Annotated[int, ApiDescription("Number of errored images")]
    skipped: Annotated[
        list[SnapshotImageResponseDict],
        ApiDescription("Base images that a selective upload didn't include"),
    ]
    skipped_count: Annotated[int, ApiDescription("Number of skipped images")]
    diff_threshold: Annotated[
        float | None,
        ApiDescription(
            "Fraction of changed pixels, from 0 to 1, above which an image counts as changed. Images can override it"
        ),
    ]
    comparison_state: Annotated[
        str | None,
        ApiDescription(
            "State of the latest comparison: pending, processing, success, failed, waiting_for_base or no_base_build"
        ),
    ]
    approval_status: Annotated[
        str | None,
        ApiDescription(
            "Approval status of the latest comparison: approved, auto_approved or requires_approval"
        ),
    ]
    comparison_error_message: Annotated[
        str | None, ApiDescription("Error message when the latest comparison failed")
    ]
    approvers: Annotated[
        list[SnapshotApproverResponseDict],
        ApiDescription("People who approved the snapshot changes"),
    ]


class SnapshotCreateResponseDict(TypedDict):
    artifactId: Annotated[str, ApiDescription("ID of the build created for the snapshot")]
    snapshotMetricsId: Annotated[str, ApiDescription("ID of the snapshot")]
    imageCount: Annotated[int, ApiDescription("Number of images in the snapshot")]
    snapshotUrl: Annotated[Url, ApiDescription("URL of the snapshot in Sentry")]


class SnapshotImageDetailImageInfoResponseDict(SnapshotImageResponseDict, total=False):
    diff_threshold: Annotated[
        float | None,
        ApiDescription(
            "Fraction of changed pixels, from 0 to 1, above which the image counts as changed"
        ),
    ]
    description: Annotated[str | None, ApiDescription("Description of the image")]
    tags: Annotated[dict[str, str] | None, ApiDescription("Tags attached to the image")]
    image_url: Annotated[str, ApiDescription("API URL to download the image")]


class SnapshotImageDetailResponseDict(TypedDict, total=False):
    image_file_name: Annotated[str, ApiDescription("File name of the image")]
    comparison_status: Annotated[
        str | None,
        ApiDescription(
            "Comparison result for the image: added, removed, changed, unchanged, renamed, errored or skipped. Null when there is no comparison"
        ),
    ]
    head_image: Annotated[
        SnapshotImageDetailImageInfoResponseDict | None,
        ApiDescription("Image in the head snapshot. Null when the image was removed"),
    ]
    base_image: Annotated[
        SnapshotImageDetailImageInfoResponseDict | None,
        ApiDescription("Image in the base snapshot"),
    ]
    diff_image_url: Annotated[
        str | None,
        ApiDescription("API URL to download the diff mask image. Only set for changed images"),
    ]
    diff_percentage: Annotated[
        float | None,
        ApiDescription("Fraction of pixels that changed, from 0 to 1. Only set for changed images"),
    ]
    previous_image_file_name: Annotated[
        str | None, ApiDescription("Previous file name of the image. Only set for renamed images")
    ]


class LatestBaseSnapshotImageResponseDict(SnapshotImageResponseDict, total=False):
    image_url: Annotated[str, ApiDescription("API URL to download the image")]


class LatestBaseSnapshotVcsInfoResponseDict(TypedDict, total=False):
    head_sha: Annotated[str | None, ApiDescription("Commit SHA of the build")]
    base_sha: Annotated[
        str | None, ApiDescription("Commit SHA of the base. Empty or null for base snapshots")
    ]
    head_ref: Annotated[GitRef | None, ApiDescription("Branch or ref of the build")]
    base_ref: Annotated[GitRef | None, ApiDescription("Branch or ref of the base")]
    head_repo_name: Annotated[str | None, ApiDescription("Repository name of the build")]
    pr_number: Annotated[int | None, ApiDescription("Pull request number")]


class LatestBaseSnapshotResponseDict(TypedDict, total=False):
    head_artifact_id: Annotated[str, ApiDescription("ID of the build the snapshot belongs to")]
    project_id: Annotated[str, ApiDescription("ID of the project")]
    project_slug: Annotated[str, ApiDescription("Slug of the project")]
    app_id: Annotated[str | None, ApiDescription("App identifier of the build")]
    image_count: Annotated[int, ApiDescription("Number of images in the snapshot")]
    images: Annotated[
        list[LatestBaseSnapshotImageResponseDict], ApiDescription("Images in the snapshot")
    ]
    diff_threshold: Annotated[
        float | None,
        ApiDescription(
            "Fraction of changed pixels, from 0 to 1, above which an image counts as changed. Images can override it"
        ),
    ]
    date_added: Annotated[IsoDateTime, ApiDescription("When the build was uploaded (ISO 8601)")]
    vcs_info: Annotated[
        LatestBaseSnapshotVcsInfoResponseDict,
        ApiDescription("Version control details of the build"),
    ]
