from __future__ import annotations

import logging
import re
from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any, NotRequired, TypedDict
from urllib.parse import urlparse

import rest_framework
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from django.db.models import Q, QuerySet
from django.db.models.signals import post_save
from django.utils import timezone as django_timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features, options
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.db.models.query import create_or_update
from sentry.hybridcloud.rpc import coerce_id_from
from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs
from sentry.issues.grouptype import GroupCategory
from sentry.issues.ignored import handle_archived_until_escalating, handle_ignored
from sentry.issues.merge import MergedGroup, handle_merge
from sentry.issues.priority import update_priority
from sentry.issues.status_change import handle_status_update, infer_substatus
from sentry.issues.update_inbox import update_inbox
from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.commit import Commit
from sentry.models.group import STATUS_UPDATE_CHOICES, Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.grouphash import GroupHash
from sentry.models.grouphistory import record_group_history_from_activity_type
from sentry.models.groupinbox import GroupInboxRemoveAction, remove_group_from_inbox
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.grouptombstone import TOMBSTONE_FIELDS_FROM_GROUP, GroupTombstone
from sentry.models.project import Project
from sentry.models.release import Release, follows_semver_versioning_scheme
from sentry.notifications.types import SUBSCRIPTION_REASON_MAP, GroupSubscriptionReason
from sentry.signals import issue_resolved
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor, ActorType
from sentry.types.group import SUBSTATUS_UPDATE_CHOICES, GroupSubStatus, PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.users.services.user_option import user_option_service
from sentry.utils import metrics

from . import ACTIVITIES_COUNT, BULK_MUTATION_LIMIT, SearchFunction, delete_group_list
from .validators import GroupValidator, ValidationError

logger = logging.getLogger(__name__)


class MultipleProjectsError(Exception):
    pass


class ResolutionParams(TypedDict):
    release: Release
    type: int | None
    status: int | None
    actor_id: int | None
    current_release_version: NotRequired[str]


def handle_discard(
    request: Request,
    group_list: Sequence[Group],
    projects: Sequence[Project],
    acting_user: RpcUser | User | None,
) -> Response:
    for project in projects:
        if not features.has("projects:discard-groups", project, actor=acting_user):
            return Response({"detail": ["You do not have that feature enabled"]}, status=400)

    if any(group.issue_category != GroupCategory.ERROR for group in group_list):
        raise rest_framework.exceptions.ValidationError(
            detail="Only error issues can be discarded."
        )
    # grouped by project_id
    groups_to_delete = defaultdict(list)

    for group in group_list:
        with transaction.atomic(router.db_for_write(GroupTombstone)):
            try:
                tombstone = GroupTombstone.objects.create(
                    previous_group_id=group.id,
                    actor_id=coerce_id_from(acting_user),
                    **{name: getattr(group, name) for name in TOMBSTONE_FIELDS_FROM_GROUP},
                )
            except IntegrityError:
                # in this case, a tombstone has already been created
                # for a group, so no hash updates are necessary
                pass
            else:
                groups_to_delete[group.project_id].append(group)

                GroupHash.objects.filter(group=group).update(
                    group=None, group_tombstone_id=tombstone.id
                )

    for project in projects:
        delete_group_list(
            request, project, groups_to_delete.get(project.id, []), delete_type="discard"
        )

    return Response(status=204)


def self_subscribe_and_assign_issue(
    acting_user: RpcUser | User | None, group: Group, self_assign_issue: str
) -> Actor | None:
    """
    Used during issue resolution to assign to acting user
    returns None if the user didn't elect to self assign on resolution
    or the group is assigned already, otherwise returns Actor
    representation of current user
    """
    if acting_user:
        GroupSubscription.objects.subscribe(
            subscriber=acting_user, group=group, reason=GroupSubscriptionReason.status_change
        )

        if self_assign_issue == "1" and not group.assignee_set.exists():
            return Actor(id=acting_user.id, actor_type=ActorType.USER)
    return None


def get_current_release_version_of_group(group: Group, follows_semver: bool = False) -> str | None:
    """
    Function that returns the latest release version associated with a Group, and by latest we
    mean either most recent (date) or latest in semver versioning scheme
    Inputs:
        * group: Group of the issue
        * follows_semver: flag that determines whether the project of the group follows semantic
                          versioning or not.
    Returns:
        current_release_version
    """
    current_release_version = None
    if follows_semver:
        release = greatest_semver_release(group.project)
        if release is not None:
            current_release_version = release.version
    else:
        # This sets current_release_version to the most recent release associated with a group
        # In order to be able to do that, `use_cache` has to be set to False. Otherwise,
        # group.get_last_release might not return the actual latest release associated with a
        # group but rather a cached version (which might or might not be the actual latest. It is
        # the first latest observed by Sentry)
        current_release_version = group.get_last_release(use_cache=False)
    return current_release_version


def update_groups(
    request: Request,
    groups: Sequence[Group],
    user: RpcUser | User | AnonymousUser | None = None,
    data: Mapping[str, Any] | None = None,
) -> Response:
    # If `user` and `data` are passed as parameters then they should override
    # the values in `request`.
    user = user or request.user
    acting_user = user if user and user.is_authenticated else None
    data = data or request.data

    # so we won't have to requery for each group
    project_lookup = {g.project_id: g.project for g in groups}
    projects = list(project_lookup.values())

    # Assert all projects belong to the same organization
    if len({p.organization_id for p in projects}) > 1:
        return Response({"detail": "All groups must belong to same organization."}, status=400)

    if not groups:
        return Response({"detail": "No groups found"}, status=204)

    serializer = validate_request(request, projects, data)

    if serializer is None:
        logger.error("Error validating request. Investigate.")
        return Response(status=500)

    result = dict(serializer.validated_data)

    acting_user = user if user.is_authenticated else None

    discard = result.get("discard")
    if discard:
        return handle_discard(request, groups, projects, acting_user)

    status_details = result.pop("statusDetails", result)
    status = result.get("status")
    res_type = None
    if "priority" in result:
        handle_priority(
            priority=result["priority"],
            group_list=groups,
            acting_user=acting_user,
            project_lookup=project_lookup,
        )
    if status in ("resolved", "resolvedInNextRelease"):
        try:
            result, res_type = handle_resolve_in_release(
                status,
                status_details,
                groups,
                projects,
                project_lookup,
                acting_user,
                user,
                result,
            )
        except MultipleProjectsError:
            return Response({"detail": "Cannot set resolved for multiple projects."}, status=400)
    elif status:
        result = handle_other_status_updates(
            result,
            groups,
            projects,
            project_lookup,
            status_details,
            acting_user,
            user,
        )

    return prepare_response(
        result,
        groups,
        project_lookup,
        projects,
        acting_user,
        data,
        res_type,
        request.META.get("HTTP_REFERER", ""),
    )


def update_groups_with_search_fn(
    request: Request,
    group_ids: Sequence[int | str] | None,
    projects: Sequence[Project],
    organization_id: int,
    search_fn: SearchFunction,
) -> Response:
    group_list = []
    if group_ids:
        group_list = get_group_list(organization_id, projects, group_ids)

    if not group_list:
        try:
            # It can raise ValidationError
            cursor_result, _ = search_fn(
                {
                    "limit": BULK_MUTATION_LIMIT,
                    "paginator_options": {"max_limit": BULK_MUTATION_LIMIT},
                }
            )
        except ValidationError:
            logger.exception("Error getting group ids and group list")  # Track the error in Sentry
            return Response(
                {"detail": "Invalid query. Error getting group ids and group list"}, status=400
            )

        group_list = list(cursor_result)

    if not group_list:
        return Response({"detail": "No groups found"}, status=204)

    return update_groups(request, group_list)


def validate_request(
    request: Request,
    projects: Sequence[Project],
    data: Mapping[str, Any],
) -> GroupValidator | None:
    serializer = None
    # TODO(jess): We may want to look into refactoring GroupValidator
    # to support multiple projects, but this is pretty complicated
    # because of the assignee validation. Punting on this for now.
    for project in projects:
        serializer = GroupValidator(
            data=data,
            partial=True,
            context={
                "project": project,
                "organization": project.organization,
                "access": getattr(request, "access", None),
            },
        )
        if not serializer.is_valid():
            raise serializers.ValidationError(serializer.errors)
    return serializer


def get_group_list(
    organization_id: int,
    projects: Sequence[Project],
    group_ids: Sequence[int | str],
) -> list[Group]:
    """
    Gets group list based on provided filters.

    Args:
        organization_id: ID of the organization
        projects: Sequence of projects to filter groups by
        group_ids: Sequence of specific group IDs to fetch

    Returns: List of Group objects filtered to only valid groups in the org/projects
    """
    groups = []
    # Convert all group IDs to integers and filter out any non-integer values
    group_ids_int = [int(gid) for gid in group_ids if str(gid).isdigit()]
    if group_ids_int:
        return list(
            Group.objects.filter(
                project__organization_id=organization_id, project__in=projects, id__in=group_ids_int
            )
        )
    else:
        for group_id in group_ids:
            if isinstance(group_id, str):
                groups.append(Group.objects.by_qualified_short_id(organization_id, group_id))

    return groups


def handle_resolve_in_release(
    status: str,
    status_details: Mapping[str, Any],
    group_list: Sequence[Group],
    projects: Sequence[Project],
    project_lookup: Mapping[int, Project],
    acting_user: RpcUser | User | None,
    user: RpcUser | User | AnonymousUser,
    result: MutableMapping[str, Any],
) -> tuple[dict[str, Any], int | None]:
    res_type = None
    release = None
    commit = None
    self_assign_issue = "0"
    if acting_user:
        user_options = user_option_service.get_many(
            filter={"user_ids": [acting_user.id], "keys": ["self_assign_issue"]}
        )
        if user_options:
            self_assign_issue = user_options[0].value
    res_status = None
    if status == "resolvedInNextRelease" or status_details.get("inNextRelease"):
        # TODO(jess): We may want to support this for multi project, but punting on it for now
        if len(projects) > 1:
            raise MultipleProjectsError()
        # may not be a release yet
        release = status_details.get("inNextRelease") or get_release_to_resolve_by(projects[0])

        activity_type = ActivityType.SET_RESOLVED_IN_RELEASE.value
        activity_data = {
            # no version yet
            "version": ""
        }

        serialized_user = user_service.serialize_many(filter=dict(user_ids=[user.id]), as_user=user)
        new_status_details = {
            "inNextRelease": True,
        }
        if serialized_user:
            new_status_details["actor"] = serialized_user[0]
        res_type = GroupResolution.Type.in_next_release
        res_type_str = "in_next_release"
        res_status = GroupResolution.Status.pending
    elif status_details.get("inUpcomingRelease"):
        if len(projects) > 1:
            raise MultipleProjectsError()
        release = status_details.get("inUpcomingRelease") or most_recent_release(projects[0])
        activity_type = ActivityType.SET_RESOLVED_IN_RELEASE.value
        activity_data = {"version": ""}

        serialized_user = user_service.serialize_many(filter=dict(user_ids=[user.id]), as_user=user)
        new_status_details = {
            "inUpcomingRelease": True,
        }
        if serialized_user:
            new_status_details["actor"] = serialized_user[0]
        res_type = GroupResolution.Type.in_upcoming_release
        res_type_str = "in_upcoming_release"
        res_status = GroupResolution.Status.pending
    elif status_details.get("inRelease"):
        # TODO(jess): We could update validation to check if release
        # applies to multiple projects, but I think we agreed to punt
        # on this for now
        if len(projects) > 1:
            raise MultipleProjectsError()
        release = status_details["inRelease"]
        activity_type = ActivityType.SET_RESOLVED_IN_RELEASE.value
        activity_data = {
            # no version yet
            "version": release.version
        }

        serialized_user = user_service.serialize_many(filter=dict(user_ids=[user.id]), as_user=user)
        new_status_details = {
            "inRelease": release.version,
        }
        if serialized_user:
            new_status_details["actor"] = serialized_user[0]
        res_type = GroupResolution.Type.in_release
        res_type_str = "in_release"
        res_status = GroupResolution.Status.resolved
    elif status_details.get("inCommit"):
        # TODO(jess): Same here, this is probably something we could do, but
        # punting for now.
        if len(projects) > 1:
            raise MultipleProjectsError()
        commit = status_details["inCommit"]
        activity_type = ActivityType.SET_RESOLVED_IN_COMMIT.value
        activity_data = {"commit": commit.id}
        serialized_user = user_service.serialize_many(filter=dict(user_ids=[user.id]), as_user=user)

        new_status_details = {
            "inCommit": serialize(commit, user),
        }
        if serialized_user:
            new_status_details["actor"] = serialized_user[0]
        res_type_str = "in_commit"
    else:
        res_type_str = "now"
        activity_type = ActivityType.SET_RESOLVED.value
        activity_data = {}
        new_status_details = {}

    metrics.incr("group.resolved", instance=res_type_str, skip_internal=True)

    # if we've specified a commit, let's see if its already been released
    # this will allow us to associate the resolution to a release as if we
    # were simply using 'inRelease' above
    # Note: this is different than the way commit resolution works on deploy
    # creation, as a given deploy is connected to an explicit release, and
    # in this case we're simply choosing the most recent release which contains
    # the commit.
    if commit and not release:
        # TODO(jess): If we support multiple projects for release / commit resolution,
        # we need to update this to find the release for each project (we shouldn't assume
        # it's the same)
        try:
            release = most_recent_release_matching_commit(projects, commit)
            res_type = GroupResolution.Type.in_release
            res_status = GroupResolution.Status.resolved
        except IndexError:
            release = None
    for group in group_list:
        # If the group is already resolved, we don't need to do anything
        if group.status == GroupStatus.RESOLVED:
            continue

        with transaction.atomic(router.db_for_write(Group)):
            process_group_resolution(
                group,
                group_list,
                release,
                commit,
                res_type,
                res_status,
                acting_user,
                user,
                self_assign_issue,
                activity_type,
                activity_data,
                result,
            )

        issue_resolved.send_robust(
            organization_id=projects[0].organization_id,
            user=(acting_user or user),
            group=group,
            project=project_lookup[group.project_id],
            resolution_type=res_type_str,
            sender=update_groups,
        )

        kick_off_status_syncs.apply_async(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )

    result.update({"status": "resolved", "statusDetails": new_status_details})

    return dict(result), res_type


def process_group_resolution(
    group: Group,
    group_list: Sequence[Group],
    release: Release | None,
    commit: Commit | None,
    res_type: int | None,
    res_status: int | None,
    acting_user: RpcUser | User | None,
    user: RpcUser | User | AnonymousUser,
    self_assign_issue: str,
    activity_type: int,
    activity_data: MutableMapping[str, Any],
    result: MutableMapping[str, Any],
) -> None:
    now = django_timezone.now()
    resolution = None
    created = None
    if release:
        # These are the parameters that are set for creating a GroupResolution
        resolution_params: ResolutionParams = {
            "release": release,
            "type": res_type,
            "status": res_status,
            "actor_id": user.id if user and user.is_authenticated else None,
        }

        # We only set `current_release_version` if GroupResolution type is
        # in_next_release, because we need to store information about the latest/most
        # recent release that was associated with a group and that is required for
        # release comparisons (i.e. handling regressions)
        if res_type == GroupResolution.Type.in_next_release:
            # Check if semver versioning scheme is followed
            follows_semver = follows_semver_versioning_scheme(
                org_id=group.project.organization_id,
                project_id=group.project_id,
                release_version=release.version,
            )

            current_release_version = get_current_release_version_of_group(group, follows_semver)

            if current_release_version:
                resolution_params.update({"current_release_version": current_release_version})

                # Sets `current_release_version` for activity, since there is no point
                # waiting for when a new release is created i.e.
                # clear_expired_resolutions task to be run.
                # Activity should look like "... resolved in version
                # >current_release_version" in the UI
                if follows_semver:
                    activity_data.update({"current_release_version": current_release_version})

                    # In semver projects, and thereby semver releases, we determine
                    # resolutions by comparing against an expression rather than a
                    # specific release (i.e. >current_release_version). Consequently,
                    # at this point we can consider this GroupResolution as resolved
                    # in release
                    resolution_params.update(
                        {
                            "type": GroupResolution.Type.in_release,
                            "status": GroupResolution.Status.resolved,
                        }
                    )
                else:
                    # If we already know the `next` release in date based ordering
                    # when clicking on `resolvedInNextRelease` because it is already
                    # been released, there is no point in setting GroupResolution to
                    # be of type in_next_release but rather in_release would suffice

                    try:
                        # Get current release object from current_release_version
                        current_release_obj = Release.objects.get(
                            version=current_release_version,
                            organization_id=group.project.organization_id,
                        )

                        date_order_q = Q(date_added__gt=current_release_obj.date_added) | Q(
                            date_added=current_release_obj.date_added,
                            id__gt=current_release_obj.id,
                        )

                        # Find the next release after the current_release_version
                        # i.e. the release that resolves the issue
                        resolved_in_release = (
                            Release.objects.filter(
                                date_order_q,
                                projects=group.project,
                                organization_id=group.project.organization_id,
                            )
                            .extra(select={"sort": "COALESCE(date_released, date_added)"})
                            .order_by("sort", "id")[:1]
                            .get()
                        )

                        # If we get here, we assume it exists and so we update
                        # GroupResolution and Activity
                        resolution_params.update(
                            {
                                "release": resolved_in_release,
                                "type": GroupResolution.Type.in_release,
                                "status": GroupResolution.Status.resolved,
                            }
                        )
                        activity_data.update({"version": resolved_in_release.version})
                    except Release.DoesNotExist:
                        # If it gets here, it means we don't know the upcoming
                        # release yet because it does not exist, and so we should
                        # fall back to our current model
                        ...

        resolution, created = GroupResolution.objects.get_or_create(
            group=group, defaults=resolution_params
        )
        if not created:
            resolution.update(datetime=django_timezone.now(), **resolution_params)

    if commit:
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )

    affected = Group.objects.filter(id=group.id).update(
        status=GroupStatus.RESOLVED, resolved_at=now, substatus=None
    )
    if not resolution:
        created = bool(affected)

    group.status = GroupStatus.RESOLVED
    group.substatus = None
    group.resolved_at = now
    if affected and not options.get("groups.enable-post-update-signal"):
        post_save.send(
            sender=Group,
            instance=group,
            created=False,
            update_fields=["resolved_at", "status", "substatus"],
        )
    remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED, user=acting_user)
    result["inbox"] = None

    assigned_to = self_subscribe_and_assign_issue(acting_user, group, self_assign_issue)
    if assigned_to is not None:
        result["assignedTo"] = assigned_to

    if created:
        activity = Activity.objects.create(
            project=group.project,
            group=group,
            type=activity_type,
            user_id=acting_user.id if acting_user else None,
            ident=resolution.id if resolution else None,
            data=dict(activity_data),
        )
        record_group_history_from_activity_type(group, activity_type, actor=acting_user)

        # TODO(dcramer): we need a solution for activity rollups
        # before sending notifications on bulk changes
        if not len(group_list) > 1:
            transaction.on_commit(lambda: activity.send_notification(), router.db_for_write(Group))


def merge_groups(
    group_list: Sequence[Group],
    project_lookup: Mapping[int, Project],
    acting_user: RpcUser | User | None,
    referer: str,
) -> MergedGroup:
    issue_stream_regex = r"^(\/organizations\/[^\/]+)?\/issues\/$"
    similar_issues_tab_regex = r"^(\/organizations\/[^\/]+)?\/issues\/\d+\/similar\/$"

    metrics.incr(
        "grouping.merge_issues",
        sample_rate=1.0,
        tags={
            # We assume that if someone's merging groups, they're from the same platform
            "platform": group_list[0].platform or "unknown",
            "sdk": group_list[0].sdk or "unknown",
            # TODO: It's probably cleaner to just send this value from the front end
            "referer": (
                "issue stream"
                if re.search(issue_stream_regex, referer)
                else (
                    "similar issues tab"
                    if re.search(similar_issues_tab_regex, referer)
                    else "unknown"
                )
            ),
        },
    )
    return handle_merge(group_list, project_lookup, acting_user)


def handle_other_status_updates(
    result: dict[str, Any],
    group_list: Sequence[Group],
    projects: Sequence[Project],
    project_lookup: Mapping[int, Project],
    status_details: dict[str, Any],
    acting_user: RpcUser | User | None,
    user: RpcUser | User | AnonymousUser,
) -> dict[str, Any]:
    group_ids = [group.id for group in group_list]
    queryset = Group.objects.filter(id__in=group_ids)
    new_status = STATUS_UPDATE_CHOICES[result["status"]]
    new_substatus = None
    if result.get("substatus"):
        new_substatus = SUBSTATUS_UPDATE_CHOICES[result["substatus"]]
    new_substatus = infer_substatus(new_status, new_substatus, status_details, group_list)

    with transaction.atomic(router.db_for_write(Group)):
        status_updated = queryset.exclude(status=new_status).update(
            status=new_status, substatus=new_substatus
        )
        GroupResolution.objects.filter(group__in=group_ids).delete()
        if new_status == GroupStatus.IGNORED:
            if new_substatus == GroupSubStatus.UNTIL_ESCALATING:
                result["statusDetails"] = handle_archived_until_escalating(
                    group_list, acting_user, projects, sender=update_groups
                )
            else:
                result["statusDetails"] = handle_ignored(
                    group_list, status_details, acting_user, user
                )
            result["inbox"] = None
        else:
            result["statusDetails"] = {}

    if group_list and status_updated:
        handle_status_update(
            group_list=group_list,
            projects=projects,
            project_lookup=project_lookup,
            new_status=new_status,
            new_substatus=new_substatus,
            is_bulk=len(group_ids) > 1,
            acting_user=acting_user,
            status_details=result.get("statusDetails", {}),
            sender=update_groups,
        )
    return result


def prepare_response(
    result: dict[str, Any],
    group_list: Sequence[Group],
    project_lookup: Mapping[int, Project],
    projects: Sequence[Project],
    acting_user: RpcUser | User | None,
    data: Mapping[str, Any],
    res_type: int | None,
    referer: str,
) -> Response:
    # XXX (ahmed): hack to get the activities to work properly on issues page. Not sure of
    # what performance impact this might have & this possibly should be moved else where
    try:
        if len(group_list) == 1:
            if res_type in (
                GroupResolution.Type.in_next_release,
                GroupResolution.Type.in_release,
                GroupResolution.Type.in_upcoming_release,
            ):
                result["activity"] = serialize(
                    Activity.objects.get_activities_for_group(
                        group=group_list[0], num=ACTIVITIES_COUNT
                    ),
                    acting_user,
                )
    except UnboundLocalError:
        pass

    if "assignedTo" in result:
        result["assignedTo"] = handle_assigned_to(
            result["assignedTo"],
            data.get("assignedBy"),
            data.get("integration"),
            group_list,
            project_lookup,
            acting_user,
        )

    handle_has_seen(result.get("hasSeen"), group_list, project_lookup, projects, acting_user)

    if "isBookmarked" in result:
        handle_is_bookmarked(result["isBookmarked"], group_list, project_lookup, acting_user)

    if result.get("isSubscribed") in (True, False):
        result["subscriptionDetails"] = handle_is_subscribed(
            result["isSubscribed"], group_list, project_lookup, acting_user
        )

    if "isPublic" in result:
        result["shareId"] = handle_is_public(
            result["isPublic"], group_list, project_lookup, acting_user
        )

    # TODO: Create new endpoint for this
    if result.get("merge") and len(group_list) > 1:
        # don't allow merging cross project
        if len(project_lookup) > 1:
            return Response(
                {"detail": "Merging across multiple projects is not supported"}, status=400
            )
        result["merge"] = merge_groups(
            group_list,
            project_lookup,
            acting_user,
            urlparse(referer).path,
        )

    inbox = result.get("inbox", None)
    if inbox is not None:
        result["inbox"] = update_inbox(
            inbox,
            group_list,
            project_lookup,
            acting_user,
            sender=update_groups,
        )

    return Response(result)


def get_release_to_resolve_by(project: Project) -> Release | None:
    follows_semver = follows_semver_versioning_scheme(
        org_id=project.organization_id, project_id=project.id
    )
    return greatest_semver_release(project) if follows_semver else most_recent_release(project)


def most_recent_release(project: Project) -> Release | None:
    return (
        Release.objects.filter(projects=project, organization_id=project.organization_id)
        .extra(select={"sort": "COALESCE(date_released, date_added)"})
        .order_by("-sort")
        .first()
    )


def most_recent_release_matching_commit(
    projects: Sequence[Project], commit: Commit
) -> Release | None:
    return (
        Release.objects.filter(projects__in=projects, releasecommit__commit=commit)
        .extra(select={"sort": "COALESCE(date_released, date_added)"})
        .order_by("-sort")[0]
    )


def greatest_semver_release(project: Project) -> Release | None:
    return get_semver_releases(project).first()


def get_semver_releases(project: Project) -> QuerySet[Release]:
    return (
        Release.objects.filter(projects=project, organization_id=project.organization_id)
        .filter_to_semver()  # type: ignore[attr-defined]
        .annotate_prerelease_column()
        .order_by(*[f"-{col}" for col in Release.SEMVER_COLS])
    )


def handle_is_subscribed(
    is_subscribed: bool,
    group_list: Sequence[Group],
    project_lookup: Mapping[int, Project],
    acting_user: RpcUser | User | None,
) -> dict[str, str]:
    # TODO(dcramer): we could make these more efficient by first
    # querying for which `GroupSubscription` rows are present (if N > 2),
    # flipping the flag on those rows, and then creating the missing rows
    for group in group_list:
        # NOTE: Subscribing without an initiating event (assignment,
        # commenting, etc.) clears out the previous subscription reason
        # to avoid showing confusing messaging as a result of this
        # action. It'd be jarring to go directly from "you are not
        # subscribed" to "you were subscribed since you were
        # assigned" just by clicking the "subscribe" button (and you
        # may no longer be assigned to the issue anyway).
        GroupSubscription.objects.create_or_update(
            user_id=acting_user.id if acting_user else None,
            group=group,
            project=project_lookup[group.project_id],
            values={"is_active": is_subscribed, "reason": GroupSubscriptionReason.unknown},
        )

    return {"reason": SUBSCRIPTION_REASON_MAP.get(GroupSubscriptionReason.unknown, "unknown")}


def handle_is_bookmarked(
    is_bookmarked: bool,
    group_list: Sequence[Group],
    project_lookup: Mapping[int, Project],
    acting_user: RpcUser | User | None,
) -> None:
    """
    Creates bookmarks and subscriptions for a user, or deletes the existing bookmarks and subscriptions.
    """
    group_ids = [group.id for group in group_list]
    if is_bookmarked:
        for group in group_list:
            GroupBookmark.objects.get_or_create(
                project=project_lookup[group.project_id],
                group=group,
                user_id=acting_user.id if acting_user else None,
            )
            if acting_user:
                GroupSubscription.objects.subscribe(
                    subscriber=acting_user,
                    group=group,
                    reason=GroupSubscriptionReason.bookmark,
                )
    elif is_bookmarked is False and acting_user is not None:
        GroupBookmark.objects.filter(
            group__in=group_ids,
            user_id=acting_user.id,
        ).delete()
        if group_list:
            GroupSubscription.objects.filter(
                user_id=acting_user.id,
                group__in=group_ids,
            ).delete()


def handle_has_seen(
    has_seen: bool | None,
    group_list: Sequence[Group],
    project_lookup: Mapping[int, Project],
    projects: Sequence[Project],
    acting_user: RpcUser | User | None,
) -> None:
    is_member_map = {
        project.id: (
            project.member_set.filter(user_id=acting_user.id).exists() if acting_user else False
        )
        for project in projects
    }
    user_id = acting_user.id if acting_user else None
    if has_seen:
        for group in group_list:
            if is_member_map.get(group.project_id):
                create_or_update(
                    GroupSeen,
                    group=group,
                    user_id=user_id,
                    project=project_lookup[group.project_id],
                    values={"last_seen": django_timezone.now()},
                )
    elif has_seen is False and user_id is not None:
        GroupSeen.objects.filter(
            group__in=[group.id for group in group_list], user_id=user_id
        ).delete()


def handle_priority(
    priority: str,
    group_list: Sequence[Group],
    acting_user: RpcUser | User | None,
    project_lookup: Mapping[int, Project],
) -> None:
    for group in group_list:
        priority_value = PriorityLevel.from_str(priority) if priority else None

        update_priority(
            group=group,
            priority=priority_value,
            sender="manual_update_priority",
            actor=acting_user,
            project=project_lookup[group.project_id],
        )
        group.update(priority_locked_at=django_timezone.now())


def handle_is_public(
    is_public: bool,
    group_list: Sequence[Group],
    project_lookup: Mapping[int, Project],
    acting_user: RpcUser | User | None,
) -> str | None:
    """
    Handle the isPublic flag on a group update.

    This deletes the existing share ID and creates a new share ID if isPublic is True.
    We always want to delete an existing share, because triggering an isPublic=True
    when it's already public should trigger regenerating.
    """
    user_id = acting_user.id if acting_user else None
    share_id = None
    for group in group_list:
        if GroupShare.objects.filter(group=group).delete()[0] > 0:
            share_id = None
            Activity.objects.create(
                project=project_lookup[group.project_id],
                group=group,
                type=ActivityType.SET_PRIVATE.value,
                user_id=user_id,
            )

    if is_public:
        for group in group_list:
            share, created = GroupShare.objects.get_or_create(
                project=project_lookup[group.project_id], group=group, user_id=user_id
            )
            if created:
                share_id = share.uuid
                Activity.objects.create(
                    project=project_lookup[group.project_id],
                    group=group,
                    type=ActivityType.SET_PUBLIC.value,
                    user_id=user_id,
                )

    return share_id


def handle_assigned_to(
    assigned_actor: Actor,
    assigned_by: str | None,
    integration: str | None,
    group_list: Sequence[Group],
    project_lookup: Mapping[int, Project],
    acting_user: RpcUser | User | None,
) -> ActorSerializerResponse | None:
    """
    Handle the assignedTo field on a group update.

    This sets a new assignee or removes existing assignees, and logs the
    manual.issue_assignment analytic.
    """
    assigned_by = (
        assigned_by if assigned_by in ["assignee_selector", "suggested_assignee"] else None
    )
    extra = (
        {"integration": integration}
        if integration in [ActivityIntegration.SLACK.value, ActivityIntegration.MSTEAMS.value]
        else dict()
    )
    if assigned_actor:
        resolved_actor = assigned_actor.resolve()
        for group in group_list:
            assignment = GroupAssignee.objects.assign(
                group, resolved_actor, acting_user, extra=extra
            )
            analytics.record(
                "manual.issue_assignment",
                organization_id=project_lookup[group.project_id].organization_id,
                project_id=group.project_id,
                group_id=group.id,
                assigned_by=assigned_by,
                had_to_deassign=assignment["updated_assignment"],
            )
        return serialize(resolved_actor, acting_user, ActorSerializer())
    else:
        for group in group_list:
            GroupAssignee.objects.deassign(group, acting_user)
            analytics.record(
                "manual.issue_assignment",
                organization_id=project_lookup[group.project_id].organization_id,
                project_id=group.project_id,
                group_id=group.id,
                assigned_by=assigned_by,
                had_to_deassign=True,
            )
        return None
