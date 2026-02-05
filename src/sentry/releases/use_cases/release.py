from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping
from datetime import datetime, timezone
from typing import Any, cast

import sentry_sdk
from django.contrib.auth.models import AnonymousUser
from django.db.models import Sum

from sentry import tagstore
from sentry.api.serializers import serialize as model_serializer
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.api.serializers.release_details_types import Author, BaseProject, LastDeploy
from sentry.api.serializers.release_details_types import Project as SerializedProject
from sentry.api.serializers.types import ReleaseSerializerResponse
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.deploy import Deploy
from sentry.models.grouprelease import GroupRelease
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
    current_project_meta: dict[str, Any] | None = None,
    no_snuba_for_release_creation: bool = False,
) -> list[ReleaseSerializerResponse]:
    if not releases:
        return []

    project_ids = [p.id for p in projects]
    release_ids = [r.id for r in releases]

    release_adoption_stages = get_release_adoption_stages(
        environment_ids, project_ids, release_ids, fetch_releases_adoption_stages
    )
    new_groups_map = get_release_project_new_group_count(
        environment_ids,
        project_ids,
        release_ids,
        fetch_release_project_new_groups=fetch_issue_count,
    )
    authors_map = get_authors(
        [(r.id, r.authors or []) for r in releases],
        lambda author_ids: fetch_authors(user, organization_id, author_ids),
    )
    commits_map = get_last_commits(
        [(r.id, r.last_commit_id) for r in releases],
        lambda commit_ids: fetch_commits(user, organization_id, commit_ids),
    )
    deploys_map = get_last_deploys(
        [(r.id, r.last_deploy_id) for r in releases],
        lambda deploy_ids: fetch_deploys(user, organization_id, deploy_ids),
    )
    owners_map = get_owners(
        [(r.id, r.owner_id) for r in releases],
        fetch_owners=lambda owner_ids: fetch_owners(user, owner_ids),
    )

    project_map = get_projects(projects, fetch_project_platforms)

    release_projects_map = get_release_projects(new_groups_map, project_map)

    adoption_stage_map: dict[int, dict[str, AdoptionStage]] = {
        rid: {project_map[pid]["slug"]: adoption_stage for pid, adoption_stage in mapping}
        for rid, mapping in release_adoption_stages.items()
    }

    if environment_ids:
        first_seen_map, last_seen_map = get_release_project_environment_first_last_seen(
            release_ids,
            environment_ids,
            project_ids,
            fetch_first_last_seen=fetch_first_last_seen,
        )
    else:
        first_seen_map, last_seen_map = get_release_project_first_last_seen(
            {r.version: r.id for r in releases},
            organization_id,
            project_ids,
            no_snuba_for_release_creation=no_snuba_for_release_creation,
            fetch_first_last_seen=tagstore.backend.get_release_tags,
        )

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


def get_release_projects(
    new_groups_map: defaultdict[int, dict[int, int]], project_map: dict[int, BaseProject]
) -> defaultdict[int, list[SerializedProject]]:
    release_projects_map: defaultdict[int, list[SerializedProject]] = defaultdict(list)
    for release_id, mapping in new_groups_map.items():
        for project_id, count in mapping.items():
            release_projects_map[release_id].append({**project_map[project_id], "newGroups": count})
    return release_projects_map


@sentry_sdk.trace
def get_projects(
    projects: Iterable[Project],
    fetch_platforms: Callable[[Iterable[int]], list[tuple[int, str]]],
) -> dict[int, BaseProject]:
    platforms: defaultdict[int, list[str]] = defaultdict(list)
    for project_id, platform in fetch_platforms([p.id for p in projects]):
        platforms[project_id].append(platform)

    return {
        project.id: {
            "id": project.id,
            "slug": project.slug,
            "name": project.name,
            "platform": project.platform,
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

    result: dict[int, list[tuple[int, AdoptionStage]]] = {r: [] for r in release_ids}
    for rid, pid, adopted, unadopted in adoption_stages:
        result[rid].append((pid, adoption_stage(adopted, unadopted)))
    return result


@sentry_sdk.trace
def get_release_project_first_last_seen(
    release_version_and_id_map: dict[str, int],
    organization_id: int,
    project_ids: list[int],
    no_snuba_for_release_creation: bool,
    fetch_first_last_seen: Callable[[int, list[int], int | None, list[str]], list[Any]],
) -> tuple[dict[int, datetime | None], dict[int, datetime | None]]:
    """
    Returns a tuple of first_seen and last_seen dictionaries where the key is the release version
    and the value is a datetime representing the first or last seen timestamp.

    Example: ({package@2.0.0: 2025-01-01T00:00:00}, {package@2.0.0: 2025-12-17T11:00:51})
    """
    first_seen: dict[int, datetime | None] = {
        rid: None for rid in release_version_and_id_map.values()
    }
    last_seen: dict[int, datetime | None] = {
        rid: None for rid in release_version_and_id_map.values()
    }

    if no_snuba_for_release_creation:
        tag_values = []
    else:
        tag_values = fetch_first_last_seen(
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
def get_release_project_environment_first_last_seen(
    release_ids: list[int],
    environment_ids: list[int],
    project_ids: list[int],
    fetch_first_last_seen: Callable[
        [list[int], list[int], list[int]], list[tuple[int, datetime, datetime]]
    ],
) -> tuple[dict[int, datetime | None], dict[int, datetime | None]]:
    """
    Returns a tuple of first_seen and last_seen dictionaries where the key is the release id
    and the value is a datetime representing the first or last seen timestamp.

    This is the second location we compute this information. The other location queries Snuba for
    tag values. The distinction in which function is used is controlled by the presence of
    environment_ids in the query. For this reason, its preferable we query with environment-ids to
    reduce the latency of the serializer's responses.

    Example: ({1: 2025-01-01T00:00:00}, {1: 2025-12-17T11:00:51})
    """
    first_seen: defaultdict[int, datetime] = defaultdict(
        lambda: datetime.max.replace(tzinfo=timezone.utc)
    )
    last_seen: defaultdict[int, datetime] = defaultdict(
        lambda: datetime.min.replace(tzinfo=timezone.utc)
    )
    for rid, first, last in fetch_first_last_seen(environment_ids, project_ids, release_ids):
        first_seen[rid] = min(first_seen[rid], first)
        last_seen[rid] = max(last_seen[rid], last)

    fs: dict[int, datetime | None] = {rid: None for rid in release_ids}
    ls: dict[int, datetime | None] = {rid: None for rid in release_ids}

    for id, dt in first_seen.items():
        fs[id] = dt
    for id, dt in last_seen.items():
        ls[id] = dt

    return fs, ls


@sentry_sdk.trace
def get_release_project_new_group_count(
    environment_ids: list[int],
    project_ids: list[int],
    release_ids: list[int],
    fetch_release_project_new_groups: Callable[
        [list[int], list[int], list[int]], list[tuple[int, int, int | None]]
    ],
) -> defaultdict[int, dict[int, int]]:
    """
    Returns a count of new groups associated to a project associated to a release.

    Example: {release_id: {project_id: count}}
    """
    group_counts_by_release: defaultdict[int, dict[int, int]] = defaultdict(dict)

    for pid, rid, count in fetch_release_project_new_groups(
        environment_ids, project_ids, release_ids
    ):
        group_counts_by_release[rid][pid] = count or 0

    return group_counts_by_release


@sentry_sdk.trace
def get_authors(
    release_and_author_ids: list[tuple[int, list[str]]],
    fetch_authors: Callable[[Iterable[str]], Mapping[str, Author]],
) -> defaultdict[int, list[Author]]:
    """Returns a mapping of release-id -> author."""
    author_ids = {author for r in release_and_author_ids for author in r[1]}
    authors = fetch_authors(author_ids) if author_ids else {}

    result: defaultdict[int, list[Author]] = defaultdict(list)
    for r in release_and_author_ids:
        seen_emails: set[str] = set()
        for author_id in r[1]:
            author = authors.get(author_id, None)
            if author and author["email"] not in seen_emails:
                seen_emails.add(author["email"])
                result[r[0]].append(author)
    return result


@sentry_sdk.trace
def get_last_commits(
    release_and_commit_ids: Iterable[tuple[int, int | None]],
    fetch_last_commits: Callable[[Iterable[int]], dict[int, dict[str, Any]]],
) -> dict[int, dict[str, Any] | None]:
    """Returns a mapping of release-id -> last-commit."""
    commit_ids = {r[1] for r in release_and_commit_ids if r[1] is not None}
    commit_map = fetch_last_commits(commit_ids) if commit_ids else {}
    return {r[0]: commit_map.get(r[1]) if r[1] else None for r in release_and_commit_ids}


@sentry_sdk.trace
def get_last_deploys(
    release_and_deploy_ids: Iterable[tuple[int, int | None]],
    fetch_last_deploys: Callable[[Iterable[int]], dict[int, LastDeploy]],
) -> dict[int, LastDeploy | None]:
    """Returns a mapping of release-id -> deploy."""
    deploy_ids = {r[1] for r in release_and_deploy_ids if r[1] is not None}
    deploy_map = fetch_last_deploys(deploy_ids) if deploy_ids else {}
    return {r[0]: deploy_map.get(r[1]) if r[1] else None for r in release_and_deploy_ids}


@sentry_sdk.trace
def get_owners(
    release_and_owner_ids: Iterable[tuple[int, int | None]],
    fetch_owners: Callable[[Iterable[int]], dict[int, dict[str, Any]]],
) -> dict[int, dict[str, Any] | None]:
    """Returns a mapping of release-id -> user."""
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
    queryset = queryset.filter(project_id__in=project_ids)
    if environment_ids:
        queryset = queryset.filter(environment_id__in=environment_ids)

    return list(queryset.values_list("release_id", "project_id", "adopted", "unadopted"))


@sentry_sdk.trace
def fetch_authors(
    user: AnonymousUser | User | RpcUser, organization_id: int, author_ids: Iterable[str]
) -> Mapping[str, Any]:
    authors = list(CommitAuthor.objects.filter(id__in=author_ids, organization_id=organization_id))
    return get_users_for_authors(organization_id=organization_id, authors=authors, user=user)


@sentry_sdk.trace
def fetch_commits(
    user: AnonymousUser | User | RpcUser, organization_id: int, commit_ids: Iterable[int]
) -> dict[int, dict[str, Any]]:
    commit_list = list(
        Commit.objects.filter(id__in=commit_ids, organization_id=organization_id)
        .select_related("author")
        .filter(author__organization_id=organization_id)
    )
    # XXX: This serializer is quite deep and emits at least three other queries.
    return {c.id: d for c, d in zip(commit_list, model_serializer(commit_list, user))}


@sentry_sdk.trace
def fetch_deploys(
    user: AnonymousUser | User | RpcUser, organization_id: int, deploy_ids: Iterable[int]
) -> dict[int, LastDeploy]:
    deploy_list = list(Deploy.objects.filter(id__in=deploy_ids, organization_id=organization_id))
    # XXX: This serializer queries environments.
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
def fetch_issue_count(
    environment_ids: list[int],
    project_ids: list[int],
    release_ids: list[int],
) -> list[tuple[int, int, int | None]]:
    """
    Return a list of project_id, release_id, new_issues_count triples.

    Ideally we have one source of truth. Because we don't actually break out the counts by
    environment it seems pointless to aggregate by environment just because the environment
    happened to be specified by the query. But, at the moment, I have no way of knowing if these
    two models are guranteed to represent the same information. In the test-suite they certainly
    don't. In production I imagine there's enough behavioral holes that its possible these counts
    diverge.
    """
    if environment_ids:
        qs1 = ReleaseProjectEnvironment.objects.filter(release_id__in=release_ids)
        qs1 = qs1.filter(environment_id__in=environment_ids)
        qs1 = qs1.filter(project_id__in=project_ids)
        return list(
            qs1.values("project_id", "release_id")
            .annotate(new_groups=Sum("new_issues_count"))
            .values_list("project_id", "release_id", "new_groups")
        )
    else:
        qs2 = ReleaseProject.objects.filter(release_id__in=release_ids)
        qs2 = qs2.filter(project_id__in=project_ids)
        return list(qs2.values_list("project_id", "release_id", "new_groups"))


@sentry_sdk.trace
def fetch_first_last_seen(
    environment_ids: list[int],
    project_ids: list[int],
    release_ids: list[int],
) -> list[tuple[int, datetime, datetime]]:
    """
    Returns a list of release_id, first_seen, last_seen triples.
    """
    queryset = ReleaseProjectEnvironment.objects.filter(release_id__in=release_ids)
    queryset = queryset.filter(environment_id__in=environment_ids)
    queryset = queryset.filter(project_id__in=project_ids)
    return list(queryset.values_list("release_id", "first_seen", "last_seen"))


@sentry_sdk.trace
def fetch_project_platforms(project_ids: Iterable[int]) -> list[tuple[int, str]]:
    """
    Returns a list of project-id platform pairs for a given set of project-ids.

    Example: [(1, "javascript"), (1, "python"), (2, "python")]
    """
    return list(
        ProjectPlatform.objects.filter(project_id__in=project_ids).values_list(
            "project_id", "platform"
        )
    )


def fetch_semver_packages_for_group(
    organization_id: int, project_id: int, group_id: int
) -> list[str]:
    """Fetch a unique list of semver release packages associated with the group."""
    release_ids = (
        GroupRelease.objects.filter(
            group_id=group_id,
            project_id=project_id,
        )
        .distinct()
        .values_list("release_id", flat=True)
    )

    return cast(
        list[str],
        list(
            Release.objects.filter_to_semver()
            .filter(
                organization_id=organization_id,
                id__in=release_ids,
                package__isnull=False,
            )
            .distinct()
            .values_list("package", flat=True)
        ),
    )
