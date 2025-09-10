from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping
from datetime import datetime
from typing import Any

import sentry_sdk
from django.contrib.auth.models import AnonymousUser

from sentry import tagstore
from sentry.api.serializers import serialize as model_serializer
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.api.serializers.types import ReleaseSerializerResponse
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.deploy import Deploy
from sentry.models.project import Project
from sentry.models.projectplatform import ProjectPlatform
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import (
    AdoptionStage,
    ReleaseProjectEnvironment,
    adoption_stage,
)
from sentry.models.releases.release_project import ReleaseProject
from sentry.releases.serializers import release
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


@sentry_sdk.trace
def serialize(
    releases: list[Release],
    user: AnonymousUser | User | RpcUser,
    organization_id: int,
    environment_ids: list[int],
    projects: list[Project],
    no_snuba_for_release_creation: bool,
    current_project_meta: dict[str, Any],
) -> list[ReleaseSerializerResponse]:
    if not releases:
        return []

    project_ids = [p.id for p in projects]
    release_ids = [r.id for r in releases]

    release_adoption_stages = get_release_adoption_stages(
        environment_ids, project_ids, release_ids, fetch_releases_adoption_stages
    )
    first_seen_map, last_seen_map = get_release_project_first_last_seen(
        {r.version: r.id for r in releases},
        organization_id,
        project_ids,
        no_snuba_for_release_creation=no_snuba_for_release_creation,
        fetch_tag_values=tagstore.backend.get_release_tags,
    )
    new_groups_map = get_release_project_new_group_count(
        project_ids,
        release_ids,
        fetch_release_project_new_groups=fetch_new_groups,
    )
    authors_map = get_authors(
        [(r.id, r.authors or []) for r in releases],
        lambda author_ids: fetch_authors(user, organization_id, author_ids),
    )
    commits_map = get_last_commits(
        [(r.id, r.last_commit_id) for r in releases],
        lambda commit_ids: fetch_commits(user, commit_ids),
    )
    deploys_map = get_last_deploys(
        [(r.id, r.last_deploy_id) for r in releases],
        lambda deploy_ids: fetch_deploys(user, deploy_ids),
    )
    owners_map = get_owners(
        [(r.id, r.owner_id) for r in releases],
        fetch_owners=lambda owner_ids: fetch_owners(user, owner_ids),
    )

    project_map = get_projects(projects, new_groups_map.values(), fetch_project_platforms)

    release_projects_map = {
        release_id: [project_map[project_id] for project_id in mapping.keys()]
        for release_id, mapping in new_groups_map.items()
    }

    adoption_stage_map: dict[int, dict[str, AdoptionStage]] = {
        rid: {project_map[pid]["slug"]: adoption_stage for pid, adoption_stage in mapping}
        for rid, mapping in release_adoption_stages.items()
    }

    return release.serialize_many(
        releases,
        first_event_map=first_seen_map,
        last_event_map=last_seen_map,
        new_groups_map={rid: sum(mapping.values()) for rid, mapping in new_groups_map.items()},
        authors_map=authors_map,
        last_commit_map=commits_map,
        last_deploy_map=deploys_map,
        adoption_stage_map=adoption_stage_map,
        projects_map=release_projects_map,
        current_project_meta=current_project_meta or {},
        owner_map=owners_map,
    )


@sentry_sdk.trace
def get_projects(
    projects: Iterable[Project],
    project_group_counts: Iterable[dict[int, int]],
    fetch_platforms: Callable[[Iterable[int]], list[tuple[int, str]]],
) -> dict[int, dict[str, Any]]:
    platforms = defaultdict(list)
    for project_id, platform in fetch_platforms([p.id for p in projects]):
        platforms[project_id].append(platform)

    new_groups: defaultdict[int, int] = defaultdict(int)
    for mapping in project_group_counts:
        for project_id, count in mapping.items():
            new_groups[project_id] += count

    return {
        project.id: {
            "id": project.id,
            "slug": project.slug,
            "name": project.name,
            "platform": project.platform,
            "newGroups": new_groups[project.id],
            "platforms": platforms[project.id],
            "hasHealthData": False,
        }
        for project in projects
    }


@sentry_sdk.trace
def get_release_adoption_stages(
    environment_ids: list[int],
    project_ids: list[int],
    release_ids: list[int],
    fetch_adoption_stages: Callable[
        [list[int], list[int], list[int]],
        list[tuple[int, int, datetime | None, datetime | None]],
    ],
) -> dict[int, list[tuple[int, AdoptionStage]]]:
    adoption_stages = fetch_adoption_stages(environment_ids, project_ids, release_ids)

    result: defaultdict[int, list[tuple[int, AdoptionStage]]] = defaultdict(list)
    for rid, pid, adopted, unadopted in adoption_stages:
        result[rid].append((pid, adoption_stage(adopted, unadopted)))
    return result


@sentry_sdk.trace
def get_release_project_first_last_seen(
    release_version_and_id_map: dict[str, int],
    organization_id: int,
    project_ids: list[int],
    no_snuba_for_release_creation: bool,
    fetch_tag_values: Callable[[int, list[int], int | None, list[str]], list[Any]],
) -> tuple[dict[int, datetime], dict[int, datetime]]:
    """
    Returns a tuple of first_seen and last_seen dictionaries where the key is the release version
    and the value is a datetime representing the first or last seen timestamp.

    Example: ({package@2.0.0: 2025-01-01T00:00:00}, {package@2.0.0: 2025-12-17T11:00:51})
    """
    first_seen: dict[int, datetime] = {}
    last_seen: dict[int, datetime] = {}

    if no_snuba_for_release_creation:
        tag_values = []
    else:
        tag_values = fetch_tag_values(
            organization_id,
            project_ids,
            None,
            list(release_version_and_id_map.keys()),
        )

    for tv in tag_values:
        first_val = first_seen.get(tv.value)
        last_val = last_seen.get(tv.value)
        first_seen[release_version_and_id_map[tv.value]] = (
            min(tv.first_seen, first_val) if first_val else tv.first_seen
        )
        last_seen[release_version_and_id_map[tv.value]] = (
            max(tv.last_seen, last_val) if last_val else tv.last_seen
        )

    return first_seen, last_seen


@sentry_sdk.trace
def get_release_project_new_group_count(
    project_ids: list[int],
    release_ids: list[int],
    fetch_release_project_new_groups: Callable[
        [list[int], list[int]], list[tuple[int, int, int | None]]
    ],
) -> defaultdict[int, dict[int, int]]:
    """
    Returns a count of new groups associated to a project associated to a release.

    Example: {release_id: {project_id: count}}
    """
    group_counts_by_release: defaultdict[int, dict[int, int]] = defaultdict(dict)

    for pid, rid, count in fetch_release_project_new_groups(project_ids, release_ids):
        group_counts_by_release[rid][pid] = count or 0

    return group_counts_by_release


@sentry_sdk.trace
def get_authors(
    release_and_author_ids: list[tuple[int, list[str]]],
    fetch_authors: Callable[[Iterable[str]], Mapping[str, Any]],
) -> defaultdict[int, list[dict[str, Any]]]:
    author_ids = {author for r in release_and_author_ids for author in r[1]}
    authors = fetch_authors(author_ids) if author_ids else {}

    result: defaultdict[int, list[dict[str, Any]]] = defaultdict(list)
    for r in release_and_author_ids:
        seen_emails: set[str] = set()
        for author_id in r[1]:
            author = authors.get(author_id, None)
            if author and author["email"] not in seen_emails:
                result[r[0]].append(author)
    return result


@sentry_sdk.trace
def get_last_commits(
    release_and_commit_ids: Iterable[tuple[int, int | None]],
    fetch_last_commits: Callable[[Iterable[int]], dict[int, dict[str, Any]]],
) -> dict[int, dict[str, Any] | None]:
    commit_ids = {r[1] for r in release_and_commit_ids if r[1] is not None}
    commit_map = fetch_last_commits(commit_ids) if commit_ids else {}
    return {r[0]: commit_map.get(r[1]) if r[1] else None for r in release_and_commit_ids}


@sentry_sdk.trace
def get_last_deploys(
    release_and_deploy_ids: Iterable[tuple[int, int | None]],
    fetch_last_deploys: Callable[[Iterable[int]], dict[int, dict[str, Any]]],
) -> dict[int, dict[str, Any] | None]:
    deploy_ids = {r[1] for r in release_and_deploy_ids if r[1] is not None}
    deploy_map = fetch_last_deploys(deploy_ids) if deploy_ids else {}
    return {r[0]: deploy_map.get(r[1]) if r[1] else None for r in release_and_deploy_ids}


@sentry_sdk.trace
def get_owners(
    release_and_owner_ids: Iterable[tuple[int, int | None]],
    fetch_owners: Callable[[Iterable[int]], dict[int, dict[str, Any]]],
) -> dict[int, dict[str, Any] | None]:
    owner_ids = {r[1] for r in release_and_owner_ids if r[1] is not None}
    owner_map = fetch_owners(owner_ids) if owner_ids else {}
    return {r[0]: owner_map.get(r[1]) if r[1] else None for r in release_and_owner_ids}


@sentry_sdk.trace
def fetch_releases_adoption_stages(
    environment_ids: list[int],
    project_ids: list[int],
    release_ids: list[int],
) -> list[tuple[int, int, datetime | None, datetime | None]]:
    queryset = ReleaseProjectEnvironment.objects.filter(release_id__in=release_ids)

    if environment_ids:
        queryset = queryset.filter(environment_id__in=environment_ids)
    if project_ids:
        queryset = queryset.filter(project_id__in=project_ids)

    return list(
        queryset.order_by("-first_seen").values_list(
            "release_id", "project_id", "adopted", "unadopted"
        )
    )


@sentry_sdk.trace
def fetch_authors(
    user: AnonymousUser | User | RpcUser, organization_id: int, author_ids: Iterable[str]
) -> Mapping[str, Any]:
    authors = list(CommitAuthor.objects.filter(id__in=author_ids))
    return get_users_for_authors(organization_id=organization_id, authors=authors, user=user)


@sentry_sdk.trace
def fetch_commits(
    user: AnonymousUser | User | RpcUser, commit_ids: Iterable[int]
) -> dict[int, dict[str, Any]]:
    commit_list = list(Commit.objects.filter(id__in=commit_ids).select_related("author"))
    return {c.id: d for c, d in zip(commit_list, model_serializer(commit_list, user))}


@sentry_sdk.trace
def fetch_deploys(
    user: AnonymousUser | User | RpcUser, deploy_ids: Iterable[int]
) -> dict[int, dict[str, Any]]:
    deploy_list = list(Deploy.objects.filter(id__in=deploy_ids))
    return {d.id: c for d, c in zip(deploy_list, model_serializer(deploy_list, user))}


@sentry_sdk.trace
def fetch_owners(
    user: AnonymousUser | User | RpcUser, owner_ids: Iterable[int]
) -> dict[int, dict[str, Any]]:
    users = user_service.serialize_many(
        filter={"user_ids": owner_ids}, as_user=serialize_generic_user(user)
    )
    return {user["id"]: user for user in users}


@sentry_sdk.trace
def fetch_new_groups(
    project_ids: list[int], release_ids: list[int]
) -> list[tuple[int, int, int | None]]:
    return list(
        ReleaseProject.objects.filter(
            project_id__in=project_ids,
            release_id__in=release_ids,
            new_groups__isnull=False,
        ).values_list("project_id", "release_id", "new_groups")
    )


@sentry_sdk.trace
def fetch_project_platforms(project_ids: Iterable[int]) -> list[tuple[int, str]]:
    return list(
        ProjectPlatform.objects.filter(project_id__in=project_ids).values_list(
            "project_id", "platform"
        )
    )
