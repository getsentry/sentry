from __future__ import annotations

from typing import TypedDict

from sentry.preprod.models import PreprodArtifact


class AppInfoResponseDict(TypedDict):
    appId: str | None
    name: str | None
    version: str | None
    buildNumber: int | None
    artifactType: str | None
    dateAdded: str | None
    dateBuilt: str | None


class GitInfoResponseDict(TypedDict):
    headSha: str | None
    baseSha: str | None
    provider: str | None
    headRepoName: str | None
    baseRepoName: str | None
    headRef: str | None
    baseRef: str | None
    prNumber: int | None


def create_app_info_dict(artifact: PreprodArtifact) -> AppInfoResponseDict:
    mobile_app_info = getattr(artifact, "mobile_app_info", None)

    return {
        "appId": artifact.app_id,
        "name": mobile_app_info.app_name if mobile_app_info else None,
        "version": mobile_app_info.build_version if mobile_app_info else None,
        "buildNumber": mobile_app_info.build_number if mobile_app_info else None,
        "artifactType": PreprodArtifact.ArtifactType(artifact.artifact_type).name
        if artifact.artifact_type is not None
        else None,
        "dateAdded": artifact.date_added.isoformat() if artifact.date_added else None,
        "dateBuilt": artifact.date_built.isoformat() if artifact.date_built else None,
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
