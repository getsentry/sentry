"""
V2 Release Serializer.
"""

from collections.abc import Iterable, MutableMapping
from datetime import datetime
from typing import Any

from sentry.api.serializers.models.release import ReleaseSerializerResponse, expose_version_info
from sentry.models.release import Release, ReleaseStatus
from sentry.models.releaseprojectenvironment import AdoptionStage


def serialize_many(
    releases: Iterable[Release],
    first_event_map: MutableMapping[int, datetime],
    last_event_map: MutableMapping[int, datetime],
    new_groups_map: MutableMapping[int, int],
    last_commit_map: MutableMapping[int, MutableMapping[str, Any] | None],
    last_deploy_map: MutableMapping[int, MutableMapping[str, Any] | None],
    authors_map: MutableMapping[int, list[MutableMapping[str, Any]]],
    projects_map: MutableMapping[int, list[MutableMapping[str, Any]]],
    current_project_meta: MutableMapping[str, Any],
    adoption_stage_map: MutableMapping[int, MutableMapping[str, AdoptionStage]] | None = None,
    owner_map: MutableMapping[int, MutableMapping[str, Any] | None] = None,
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
            adoption_stage=adoption_stage_map[release.id],
            owner=owner_map[release.id] if owner_map else None,
        )
        for release in releases
    ]


def serialize(
    release: Release,
    first_event: datetime,
    last_event: datetime,
    new_groups: int,
    last_commit: MutableMapping[str, Any],
    last_deploy: MutableMapping[str, Any],
    authors: Iterable[MutableMapping[str, Any]],
    projects: Iterable[MutableMapping[str, Any]],
    current_project_meta: MutableMapping[str, Any],
    adoption_stage: MutableMapping[str, AdoptionStage] | None = None,
    owner: MutableMapping[str, Any] | None = None,
) -> ReleaseSerializerResponse:
    """
    Return a serialized Release model.

    Data dependencies not contained within the Release model object are passed as arguments.
    """
    serialized_result: ReleaseSerializerResponse = {
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
    }
    if adoption_stage:
        serialized_result["adoption_stages"] = adoption_stage

    return serialized_result
