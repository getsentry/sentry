"""
Release Serializer.
"""

from datetime import datetime
from typing import int, Any

from sentry.api.serializers.models.release import expose_version_info
from sentry.api.serializers.release_details_types import Author, LastDeploy, Project
from sentry.api.serializers.types import ReleaseSerializerResponse
from sentry.models.release import Release, ReleaseStatus
from sentry.models.releaseprojectenvironment import AdoptionStage


def serialize_many(
    releases: list[Release],
    first_event_map: dict[int, datetime | None],
    last_event_map: dict[int, datetime | None],
    new_groups_map: dict[int, int],
    last_commit_map: dict[int, dict[str, Any] | None],
    last_deploy_map: dict[int, LastDeploy | None],
    authors_map: dict[int, list[Author]],
    projects_map: dict[int, list[Project]],
    current_project_meta: dict[str, Any],
    owner_map: dict[int, dict[str, Any] | None],
    adoption_stage_map: dict[int, dict[str, AdoptionStage]] | None = None,
) -> list[ReleaseSerializerResponse]:
    """
    Return a sequence of serialized Release models.

    Data dependencies not contained within the Release model object are passed as "*_map" arguments
    where the key is the release's id and the value is whatever is required within a single object
    response serializer.
    """
    return [
        serialize(
            release,
            first_event=first_event_map[release.id],
            last_event=last_event_map[release.id],
            new_groups=new_groups_map[release.id],
            last_commit=last_commit_map[release.id],
            last_deploy=last_deploy_map[release.id],
            authors=authors_map[release.id],
            projects=projects_map[release.id],
            current_project_meta=current_project_meta,
            adoption_stage=adoption_stage_map[release.id] if adoption_stage_map else None,
            owner=owner_map[release.id] if owner_map else None,
        )
        for release in releases
    ]


def serialize(
    release: Release,
    first_event: datetime | None,
    last_event: datetime | None,
    new_groups: int,
    last_commit: dict[str, Any] | None,
    last_deploy: LastDeploy | None,
    authors: list[Author],
    projects: list[Project],
    current_project_meta: dict[str, Any],
    owner: dict[str, Any] | None,
    adoption_stage: dict[str, AdoptionStage] | None = None,
) -> ReleaseSerializerResponse:
    """
    Return a serialized Release model.

    Data dependencies not contained within the Release model object are passed as arguments.
    """
    return {
        "authors": authors,
        "commitCount": release.commit_count,
        "currentProjectMeta": current_project_meta,
        "data": release.data,
        "dateCreated": release.date_added,
        "dateReleased": release.date_released,
        "deployCount": release.total_deploys,
        "firstEvent": first_event,
        "id": release.id,
        "lastCommit": last_commit,
        "lastDeploy": last_deploy,
        "lastEvent": last_event,
        "newGroups": new_groups,
        "owner": owner,
        "projects": projects,
        "ref": release.ref,
        "shortVersion": release.version,
        "status": ReleaseStatus.to_string(release.status),
        "url": release.url,
        "userAgent": release.user_agent,
        "version": release.version,
        "versionInfo": expose_version_info(release.version_info),
        "adoptionStages": adoption_stage,
    }
