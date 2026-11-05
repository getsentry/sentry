from __future__ import annotations

from typing import Annotated, Literal, TypedDict, cast

from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import GitRef, IsoDateTime, iso_datetime
from sentry.preprod.models import PreprodArtifact

# Names of PreprodArtifact.ArtifactType
ArtifactTypeName = Literal["XCARCHIVE", "AAB", "APK"]


class AppInfoResponseDict(TypedDict):
    appId: Annotated[str | None, ApiDescription("App identifier of the build")]
    name: Annotated[str | None, ApiDescription("App name")]
    version: Annotated[str | None, ApiDescription("Version of the build")]
    buildNumber: Annotated[int | None, ApiDescription("Build number")]
    artifactType: Annotated[ArtifactTypeName | None, ApiDescription("Type of the build file")]
    dateAdded: Annotated[
        IsoDateTime | None, ApiDescription("When the build was uploaded (ISO 8601)")
    ]
    dateBuilt: Annotated[IsoDateTime | None, ApiDescription("When the build was built (ISO 8601)")]


class GitInfoResponseDict(TypedDict):
    headSha: Annotated[str | None, ApiDescription("Commit SHA of the build")]
    baseSha: Annotated[
        str | None, ApiDescription("Commit SHA of the base the build is compared against")
    ]
    provider: Annotated[str | None, ApiDescription("Version control provider, such as github")]
    headRepoName: Annotated[str | None, ApiDescription("Repository name of the head commit")]
    baseRepoName: Annotated[str | None, ApiDescription("Repository name of the base commit")]
    headRef: Annotated[GitRef | None, ApiDescription("Branch or ref of the head commit")]
    baseRef: Annotated[GitRef | None, ApiDescription("Branch or ref of the base commit")]
    prNumber: Annotated[int | None, ApiDescription("Pull request number")]


def create_app_info_dict(artifact: PreprodArtifact) -> AppInfoResponseDict:
    mobile_app_info = artifact.get_mobile_app_info()

    return {
        "appId": artifact.app_id,
        "name": mobile_app_info.app_name if mobile_app_info else None,
        "version": mobile_app_info.build_version if mobile_app_info else None,
        "buildNumber": mobile_app_info.build_number if mobile_app_info else None,
        "artifactType": cast(
            ArtifactTypeName, PreprodArtifact.ArtifactType(artifact.artifact_type).name
        )
        if artifact.artifact_type is not None
        else None,
        "dateAdded": iso_datetime(artifact.date_added) if artifact.date_added else None,
        "dateBuilt": iso_datetime(artifact.date_built) if artifact.date_built else None,
    }


def create_git_info_dict(artifact: PreprodArtifact) -> GitInfoResponseDict | None:
    commit_comparison = getattr(artifact, "commit_comparison", None)
    if commit_comparison is None:
        return None

    return {
        "headSha": commit_comparison.head_sha,
        "baseSha": commit_comparison.base_sha,
        "provider": commit_comparison.provider,
        "headRepoName": commit_comparison.head_repo_name,
        "baseRepoName": commit_comparison.base_repo_name,
        "headRef": commit_comparison.head_ref,
        "baseRef": commit_comparison.base_ref,
        "prNumber": commit_comparison.pr_number,
    }
