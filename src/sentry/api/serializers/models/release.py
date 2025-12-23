from __future__ import annotations

import datetime
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any, NotRequired, TypedDict, Union

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.db.models import Sum

from sentry import release_health, tagstore
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.release_details_types import VersionInfo
from sentry.api.serializers.types import (
    GroupEventReleaseSerializerResponse,
    ReleaseSerializerResponse,
)
from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.deploy import Deploy
from sentry.models.projectplatform import ProjectPlatform
from sentry.models.release import Release, ReleaseStatus
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.release_health.base import ReleaseHealthOverview
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text


def expose_version_info(info) -> VersionInfo | None:
    if info is None:
        return None
    version = {"raw": info["version_raw"]}
    if info["version_parsed"]:
        version.update(
            {
                "major": info["version_parsed"]["major"],
                "minor": info["version_parsed"]["minor"],
                "patch": info["version_parsed"]["patch"],
                "pre": info["version_parsed"]["pre"],
                "buildCode": info["version_parsed"]["build_code"],
                "components": info["version_parsed"]["components"],
            }
        )
    return {
        "package": info["package"],
        "version": version,
        "description": info["description"],
        "buildHash": info["build_hash"],
    }


def _expose_health_data(data):
    if not data:
        return None
    return {
        "durationP50": data["duration_p50"],
        "durationP90": data["duration_p90"],
        "crashFreeUsers": data["crash_free_users"],
        "crashFreeSessions": data["crash_free_sessions"],
        "sessionsCrashed": data["sessions_crashed"],
        "sessionsErrored": data["sessions_errored"],
        "totalUsers": data["total_users"],
        "totalUsers24h": data["total_users_24h"],
        "totalProjectUsers24h": data["total_project_users_24h"],
        "totalSessions": data["total_sessions"],
        "totalSessions24h": data["total_sessions_24h"],
        "totalProjectSessions24h": data["total_project_sessions_24h"],
        "adoption": data["adoption"],
        "sessionsAdoption": data["sessions_adoption"],
        "stats": data.get("stats"),
        # XXX: legacy key, should be removed later.
        "hasHealthData": data["has_health_data"],
    }


def _expose_project(project):
    rv = {
        "id": project["id"],
        "slug": project["slug"],
        "name": project["name"],
        "newGroups": project["new_groups"],
        "platform": project["platform"],
        "platforms": project["platforms"],
        # XXX: Legacy should be removed
        "hasHealthData": project["has_health_data"],
    }
    if "health_data" in project:
        rv["healthData"] = _expose_health_data(project["health_data"])
    return rv


def _expose_current_project_meta(current_project_meta):
    rv = {}
    if "sessions_lower_bound" in current_project_meta:
        rv["sessionsLowerBound"] = current_project_meta["sessions_lower_bound"]
    if "sessions_upper_bound" in current_project_meta:
        rv["sessionsUpperBound"] = current_project_meta["sessions_upper_bound"]
    if "next_release_version" in current_project_meta:
        rv["nextReleaseVersion"] = current_project_meta["next_release_version"]
    if "prev_release_version" in current_project_meta:
        rv["prevReleaseVersion"] = current_project_meta["prev_release_version"]
    if "first_release_version" in current_project_meta:
        rv["firstReleaseVersion"] = current_project_meta["first_release_version"]
    if "last_release_version" in current_project_meta:
        rv["lastReleaseVersion"] = current_project_meta["last_release_version"]
    return rv


class _AuthorList(TypedDict):
    authors: list[Author]


def _get_authors_metadata(
    item_list: list[Release], user: User | RpcUser | AnonymousUser
) -> dict[Release, _AuthorList]:
    """
    Returns a dictionary of release_id => authors metadata,
    where each commit metadata dict contains an array of
    authors.
    e.g.
    {
        1: {
            'authors': [<User id=1>, <User id=2>]
        },
        ...
    }
    """
    author_ids = set()
    for obj in item_list:
        if obj.authors is not None:
            author_ids.update(obj.authors)

    if author_ids:
        authors = list(CommitAuthor.objects.filter(id__in=author_ids))
    else:
        authors = []

    if authors:
        org_ids = {item.organization_id for item in item_list}
        if len(org_ids) != 1:
            users_by_author: Mapping[str, Author] = {}
        else:
            users_by_author = get_users_for_authors(
                organization_id=org_ids.pop(), authors=authors, user=user
            )
    else:
        users_by_author = {}

    result: dict[Release, _AuthorList] = {}
    for item in item_list:
        item_authors = []
        seen_authors = set()
        if item.authors is not None:
            for user_resp in (users_by_author.get(a) for a in item.authors):
                if user_resp and user_resp["email"] not in seen_authors:
                    seen_authors.add(user_resp["email"])
                    item_authors.append(user_resp)

        result[item] = {"authors": item_authors}
    return result


def _get_last_commit_metadata(item_list, user):
    """
    Returns a dictionary of release_id => commit metadata,
    where each commit metadata dict contains last_commit.
    e.g.
    {
        1: {
            'last_commit': <Commit id=1>,
        },
        ...
    }
    """
    commit_ids = {o.last_commit_id for o in item_list if o.last_commit_id}
    if commit_ids:
        commit_list = list(Commit.objects.filter(id__in=commit_ids).select_related("author"))
        commits = {c.id: d for c, d in zip(commit_list, serialize(commit_list, user))}
    else:
        commits = {}

    result = {}
    for item in item_list:
        result[item] = {
            "last_commit": commits.get(item.last_commit_id),
        }
    return result


def _get_last_deploy_metadata(item_list, user):
    """
    Returns a dictionary of release_id => deploy metadata,
    where each commit metadata dict contains last_deploy
    e.g.
    {
        1: {
            'latest_commit': <Commit id=1>,
            'authors': [<User id=1>, <User id=2>]
        },
        ...
    }
    """
    deploy_ids = {o.last_deploy_id for o in item_list if o.last_deploy_id}
    if deploy_ids:
        deploy_list = list(Deploy.objects.filter(id__in=deploy_ids))
        deploys = {d.id: c for d, c in zip(deploy_list, serialize(deploy_list, user))}
    else:
        deploys = {}

    result = {}
    for item in item_list:
        result[item] = {"last_deploy": deploys.get(item.last_deploy_id)}
    return result


def _user_to_author_cache_key(organization_id: int, author: CommitAuthor) -> str:
    author_hash = md5_text(author.email.lower()).hexdigest()
    return f"get_users_for_authors:{organization_id}:{author_hash}"


class NonMappableUser(TypedDict):
    name: str | None
    email: str


Author = Union[UserSerializerResponse, NonMappableUser]


def get_author_users_by_external_actors(
    authors: list[CommitAuthor], organization_id: int
) -> tuple[dict[CommitAuthor, str], list[CommitAuthor]]:
    found: dict[CommitAuthor, str] = {}

    usernames_to_authors: dict[str, CommitAuthor] = {}
    for author in authors:
        username = author.get_username_from_external_id()
        if username:
            # ExternalActor.external_name includes @ prefix
            # (e.g., "@username") for GitHub and GitLab
            usernames_to_authors[f"@{username}"] = author

    if not usernames_to_authors:
        return found, authors

    external_actors = (
        ExternalActor.objects.filter(
            external_name__in=list(usernames_to_authors.keys()),
            organization_id=organization_id,
            user_id__isnull=False,  # excludes team mappings
        )
        .order_by("id")
        .values_list("user_id", "external_name")
    )

    if not external_actors:
        return found, authors

    missed: dict[int, CommitAuthor] = {a.id: a for a in authors}

    for user_id, external_name in external_actors:
        if external_name in usernames_to_authors:
            found_author = usernames_to_authors[external_name]
            found[found_author] = str(user_id)
            missed.pop(found_author.id, None)

    return found, list(missed.values())


def get_author_users_by_email(
    authors: list[CommitAuthor], organization_id: int
) -> tuple[dict[CommitAuthor, str], list[CommitAuthor]]:
    author_email_map: dict[str, CommitAuthor] = {a.email.lower(): a for a in authors}

    users: list[RpcUser] = user_service.get_many(
        filter={
            "emails": list(author_email_map.keys()),
            "organization_id": organization_id,
            "is_active": True,
        }
    )

    if not users:
        return {}, authors

    missed: dict[int, CommitAuthor] = {a.id: a for a in authors}
    primary_match: dict[CommitAuthor, str] = {}
    secondary_match: dict[CommitAuthor, str] = {}

    for user in users:

        primary_email = user.email.lower()
        if primary_email in author_email_map:
            found_author = author_email_map[primary_email]
            primary_match[found_author] = str(user.id)
            missed.pop(found_author.id, None)

        for email in user.emails:
            secondary_email = email.lower()
            if secondary_email in author_email_map:
                found_author = author_email_map[secondary_email]
                if found_author not in primary_match:
                    secondary_match[found_author] = str(user.id)
                    missed.pop(found_author.id, None)

    # merge matches, primary_match is kept if collision
    found: dict[CommitAuthor, str] = secondary_match | primary_match

    return found, list(missed.values())


def get_cached_results(
    authors: list[CommitAuthor], organization_id: int
) -> tuple[dict[str, Author], list[CommitAuthor]]:
    cached_results: dict[str, Author] = {}
    fetched = cache.get_many(
        [_user_to_author_cache_key(organization_id, author) for author in authors]
    )

    if not fetched:
        return cached_results, authors

    missed = []
    for author in authors:
        fetched_user = fetched.get(_user_to_author_cache_key(organization_id, author))
        if fetched_user is None:
            missed.append(author)
        else:
            cached_results[str(author.id)] = fetched_user

    return cached_results, missed


def get_users_for_authors(
    organization_id: int,
    authors: list[CommitAuthor],
    user: User | AnonymousUser | RpcUser | None = None,
) -> Mapping[str, Author]:
    """
    Returns a dictionary of commit_author_id => user, if a Sentry
    user object exists for that email. If there is no matching
    Sentry user, a {user, email} dict representation of that
    commit author is returned.
    e.g.
    {
        '<commit-author-id-1>': serialized(<User id=1, ...>),
        '<commit-author-id-2>': {'email': 'not-a-user@example.com', 'name': 'dunno'},
        '<commit-author-id-3>': serialized(<User id=3, ...>),
        ...
    }
    """
    cached_results, missed = get_cached_results(authors, organization_id)

    if not missed:
        metrics.incr("sentry.release.get_users_for_authors.missed", amount=0)
        metrics.incr("sentry.release.get_users_for_authors.total", amount=len(cached_results))
        return cached_results

    # User Mappings take precedence over email lookup (higher signal)
    external_actor_results, remaining_missed_authors = get_author_users_by_external_actors(
        missed, organization_id
    )

    if remaining_missed_authors:
        email_results, remaining_missed_authors = get_author_users_by_email(
            remaining_missed_authors, organization_id
        )
    else:
        email_results = {}

    unserialized_results: Mapping[CommitAuthor, str] = {
        **external_actor_results,
        **email_results,
    }

    serialized_users: Sequence[UserSerializerResponse] = user_service.serialize_many(
        filter={"user_ids": list(unserialized_results.values())},
        as_user=serialize_generic_user(user),
    )

    user_id_to_serialized_user_map: dict[str, UserSerializerResponse] = {
        u["id"]: u for u in serialized_users
    }

    serialized_results: dict[str, UserSerializerResponse] = {}
    for commit_author, user_id in unserialized_results.items():
        # edge case: a user from unserialized_results could not come back in serialized_users
        if user_id in user_id_to_serialized_user_map:
            serialized_results[str(commit_author.id)] = user_id_to_serialized_user_map[user_id]
        else:
            remaining_missed_authors.append(commit_author)

    authors_with_no_matches: dict[str, NonMappableUser] = {}
    for author in remaining_missed_authors:
        authors_with_no_matches[str(author.id)] = {
            "name": author.name,
            "email": author.email,
        }

    final_results = {**cached_results, **serialized_results, **authors_with_no_matches}

    to_cache = {}
    for author in missed:
        to_cache[_user_to_author_cache_key(organization_id, author)] = final_results[str(author.id)]
    cache.set_many(to_cache)

    metrics.incr("sentry.release.get_users_for_authors.missed", amount=len(missed))
    metrics.incr("sentry.release.get_users_for_authors.total", amount=len(final_results))
    return final_results


class _ProjectDict(TypedDict):
    id: int
    slug: str | None
    name: str
    new_groups: int | None
    platform: str | None
    platforms: list[str]
    health_data: NotRequired[ReleaseHealthOverview | None]
    has_health_data: NotRequired[bool]


@register(Release)
class ReleaseSerializer(Serializer):
    def __get_project_id_list(self, item_list) -> list[int]:
        project_ids = set()
        need_fallback = False

        for release in item_list:
            if release._for_project_id is not None:
                project_ids.add(release._for_project_id)
            else:
                need_fallback = True

        if not need_fallback:
            return sorted(project_ids)

        return list(
            ReleaseProject.objects.filter(release__in=item_list)
            .values_list("project_id", flat=True)
            .distinct()
        )

    def __get_release_data_no_environment(self, project, item_list, no_snuba_for_release_creation):
        if project is not None:
            project_ids = [project.id]
            organization_id = project.organization_id
        else:
            project_ids = self.__get_project_id_list(item_list)
            organization_id = item_list[0].organization_id

        first_seen: dict[str, datetime.datetime] = {}
        last_seen: dict[str, datetime.datetime] = {}
        if no_snuba_for_release_creation:
            tag_values = []
        else:
            tag_values = tagstore.backend.get_release_tags(
                organization_id,
                project_ids,
                environment_id=None,
                versions=[o.version for o in item_list],
            )

        for tv in tag_values:
            first_val = first_seen.get(tv.value)
            last_val = last_seen.get(tv.value)
            first_seen[tv.value] = min(tv.first_seen, first_val) if first_val else tv.first_seen
            last_seen[tv.value] = max(tv.last_seen, last_val) if last_val else tv.last_seen

        group_counts_by_release = {}
        if project is not None:
            for release_id, new_groups in ReleaseProject.objects.filter(
                project=project, release__in=item_list, new_groups__isnull=False
            ).values_list("release_id", "new_groups"):
                group_counts_by_release[release_id] = {project.id: new_groups}
        else:
            for project_id, release_id, new_groups in ReleaseProject.objects.filter(
                release__in=item_list, new_groups__isnull=False
            ).values_list("project_id", "release_id", "new_groups"):
                group_counts_by_release.setdefault(release_id, {})[project_id] = new_groups

        return first_seen, last_seen, group_counts_by_release

    def _get_release_adoption_stages(self, release_project_envs):
        adoption_stages: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)

        for release_project_env in release_project_envs:
            adoption_stages[release_project_env.release.version].setdefault(
                release_project_env.project.slug, release_project_env.adoption_stages
            )

        return adoption_stages

    def __get_release_data_with_environments(self, release_project_envs):
        first_seen: dict[str, datetime.datetime] = {}
        last_seen: dict[str, datetime.datetime] = {}

        for release_project_env in release_project_envs:
            if (
                release_project_env.release.version not in first_seen
                or first_seen[release_project_env.release.version] > release_project_env.first_seen
            ):
                first_seen[release_project_env.release.version] = release_project_env.first_seen
            if (
                release_project_env.release.version not in last_seen
                or last_seen[release_project_env.release.version] < release_project_env.last_seen
            ):
                last_seen[release_project_env.release.version] = release_project_env.last_seen

        group_counts_by_release: dict[int, dict[int, int]] = {}
        for project_id, release_id, new_groups in (
            release_project_envs.values("project_id", "release_id")
            .annotate(aggregated_new_issues_count=Sum("new_issues_count"))
            .values_list("project_id", "release_id", "aggregated_new_issues_count")
        ):
            group_counts_by_release.setdefault(release_id, {})[project_id] = new_groups

        return first_seen, last_seen, group_counts_by_release

    def _get_release_project_envs(self, item_list, environments, project):
        release_project_envs = (
            ReleaseProjectEnvironment.objects.filter(release__in=item_list)
            .select_related("release", "project")
            .order_by("-first_seen")
        )
        if environments is not None:
            release_project_envs = release_project_envs.filter(environment__name__in=environments)
        if project is not None:
            release_project_envs = release_project_envs.filter(project=project)

        return release_project_envs

    def _get_release_project_envs_unordered(self, item_list, environments, project):
        release_project_envs = ReleaseProjectEnvironment.objects.filter(
            release__in=item_list
        ).select_related("release")

        if environments is not None:
            release_project_envs = release_project_envs.filter(environment__name__in=environments)
        if project is not None:
            release_project_envs = release_project_envs.filter(project=project)

        return release_project_envs

    def get_attrs(self, item_list, user, **kwargs):
        project = kwargs.get("project")

        # Some code paths pass an environment object, other pass a list of
        # environment names.
        environment = kwargs.get("environment")
        environments = kwargs.get("environments")
        if not environments:
            if environment:
                environments = [environment.name]
            else:
                environments = None

        self.with_adoption_stages = kwargs.get("with_adoption_stages", False)
        with_health_data = kwargs.get("with_health_data", False)
        health_stat = kwargs.get("health_stat", None)
        health_stats_period = kwargs.get("health_stats_period")
        summary_stats_period = kwargs.get("summary_stats_period")
        no_snuba_for_release_creation = kwargs.get("no_snuba_for_release_creation")
        if with_health_data and no_snuba_for_release_creation:
            raise TypeError("health data requires snuba")

        adoption_stages = {}
        if self.with_adoption_stages:
            release_project_envs = self._get_release_project_envs(item_list, environments, project)
            adoption_stages = self._get_release_adoption_stages(release_project_envs)

        if environments is None:
            first_seen, last_seen, issue_counts_by_release = self.__get_release_data_no_environment(
                project, item_list, no_snuba_for_release_creation
            )
        else:
            release_project_envs = self._get_release_project_envs_unordered(
                item_list, environments, project
            )
            (
                first_seen,
                last_seen,
                issue_counts_by_release,
            ) = self.__get_release_data_with_environments(release_project_envs)

        owners = {}
        owner_ids = [i.owner_id for i in item_list if i.owner_id]
        if owner_ids:
            owners = {
                d["id"]: d
                for d in user_service.serialize_many(
                    filter={"user_ids": owner_ids},
                    as_user=serialize_generic_user(user),
                )
                if d is not None
            }

        authors_metadata_attrs = _get_authors_metadata(item_list, user)
        release_metadata_attrs = _get_last_commit_metadata(item_list, user)
        deploy_metadata_attrs = _get_last_deploy_metadata(item_list, user)

        release_projects = defaultdict(list)
        project_releases = ReleaseProject.objects.filter(release__in=item_list).values(
            "new_groups",
            "release_id",
            "release__version",
            "project__slug",
            "project__name",
            "project__id",
            "project__platform",
        )

        platforms = ProjectPlatform.objects.filter(
            project_id__in={x["project__id"] for x in project_releases}
        ).values_list("project_id", "platform")
        platforms_by_project = defaultdict(list)
        for project_id, platform in platforms:
            platforms_by_project[project_id].append(platform)

        # XXX: Legacy should be removed later
        if with_health_data:
            health_data = release_health.backend.get_release_health_data_overview(
                [(pr["project__id"], pr["release__version"]) for pr in project_releases],
                health_stats_period=health_stats_period,
                summary_stats_period=summary_stats_period,
                environments=environments,
                stat=health_stat,
            )
            has_health_data = None
        else:
            health_data = None
            has_health_data = {}

        for pr in project_releases:
            # Use environment-filtered new groups count if available, otherwise fall back to ReleaseProject data
            new_groups_count_env_filtered = issue_counts_by_release.get(pr["release_id"], {}).get(
                pr["project__id"]
            )
            new_groups_count = (
                new_groups_count_env_filtered
                if new_groups_count_env_filtered is not None
                else pr["new_groups"]
            )

            pr_rv: _ProjectDict = {
                "id": pr["project__id"],
                "slug": pr["project__slug"],
                "name": pr["project__name"],
                "new_groups": new_groups_count,
                "platform": pr["project__platform"],
                "platforms": platforms_by_project.get(pr["project__id"]) or [],
            }
            # XXX: Legacy should be removed later
            if health_data is not None:
                pr_rv["health_data"] = health_data.get((pr["project__id"], pr["release__version"]))
                pr_rv["has_health_data"] = (pr_rv["health_data"] or {}).get(
                    "has_health_data", False
                )
            else:
                pr_rv["has_health_data"] = (
                    pr["project__id"],
                    pr["release__version"],
                ) in has_health_data
            release_projects[pr["release_id"]].append(pr_rv)

        result = {}
        for item in item_list:
            single_release_projects = release_projects.get(item.id, [])

            if item._for_project_id is not None:
                single_release_projects = [
                    x for x in single_release_projects if x["id"] == item._for_project_id
                ]
                release_new_groups = (issue_counts_by_release.get(item.id) or {}).get(
                    item._for_project_id
                ) or 0
            else:
                release_new_groups = sum((issue_counts_by_release.get(item.id) or {}).values())

            p = {
                "owner": owners[str(item.owner_id)] if item.owner_id else None,
                "new_groups": release_new_groups,
                "projects": single_release_projects,
                "first_seen": first_seen.get(item.version),
                "last_seen": last_seen.get(item.version),
            }
            if adoption_stages:
                p.update(
                    {
                        "adoption_stages": adoption_stages.get(item.version),
                    }
                )

            p.update(authors_metadata_attrs[item])
            p.update(release_metadata_attrs[item])
            p.update(deploy_metadata_attrs[item])

            result[item] = p
        return result

    def serialize(self, obj, attrs, user, **kwargs) -> ReleaseSerializerResponse:
        d: ReleaseSerializerResponse = {
            "id": obj.id,
            "version": obj.version,
            "status": ReleaseStatus.to_string(obj.status),
            "shortVersion": obj.version,
            "versionInfo": expose_version_info(obj.version_info),
            "ref": obj.ref,
            "url": obj.url,
            "dateReleased": obj.date_released,
            "dateCreated": obj.date_added,
            "data": obj.data,
            "newGroups": attrs["new_groups"],
            "owner": attrs["owner"],
            "commitCount": obj.commit_count,
            "lastCommit": attrs.get("last_commit"),
            "deployCount": obj.total_deploys,
            "lastDeploy": attrs.get("last_deploy"),
            "authors": attrs.get("authors", []),
            "projects": [_expose_project(p) for p in attrs.get("projects", [])],
            "firstEvent": attrs.get("first_seen"),
            "lastEvent": attrs.get("last_seen"),
            "currentProjectMeta": _expose_current_project_meta(
                kwargs.get("current_project_meta", {})
            ),
            "userAgent": obj.user_agent,
        }
        if self.with_adoption_stages:
            d.update(
                {
                    "adoptionStages": attrs.get("adoption_stages"),
                }
            )
        return d


class GroupEventReleaseSerializer(Serializer):
    """
    The minimal representation of a release necessary for group events
    """

    def get_attrs(self, item_list, user, **kwargs):
        last_commit_metadata_attrs = _get_last_commit_metadata(item_list, user)
        deploy_metadata_attrs = _get_last_deploy_metadata(item_list, user)

        result = {}
        for item in item_list:
            p = {}
            p.update(last_commit_metadata_attrs[item])
            p.update(deploy_metadata_attrs[item])

            result[item] = p
        return result

    def serialize(self, obj, attrs, user, **kwargs) -> GroupEventReleaseSerializerResponse:
        return {
            "id": obj.id,
            "commitCount": obj.commit_count,
            "data": obj.data,
            "dateCreated": obj.date_added,
            "dateReleased": obj.date_released,
            "deployCount": obj.total_deploys,
            "ref": obj.ref,
            "lastCommit": attrs.get("last_commit"),
            "lastDeploy": attrs.get("last_deploy"),
            "status": ReleaseStatus.to_string(obj.status),
            "url": obj.url,
            "userAgent": obj.user_agent,
            "version": obj.version,
            "versionInfo": expose_version_info(obj.version_info),
        }
