from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Mapping, MutableMapping, Sequence

import rest_framework
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.db.models.query import create_or_update
from sentry.issues.grouptype import GroupCategory
from sentry.issues.ignored import handle_archived_until_escalating, handle_ignored
from sentry.issues.merge import handle_merge
from sentry.issues.status_change import handle_status_update
from sentry.issues.update_inbox import update_inbox
from sentry.models import (
    TOMBSTONE_FIELDS_FROM_GROUP,
    Activity,
    ActorTuple,
    Group,
    GroupAssignee,
    GroupBookmark,
    GroupHash,
    GroupLink,
    GroupRelease,
    GroupResolution,
    GroupSeen,
    GroupShare,
    GroupStatus,
    GroupSubscription,
    GroupTombstone,
    Project,
    Release,
    Team,
    User,
    follows_semver_versioning_scheme,
    remove_group_from_inbox,
)
from sentry.models.activity import ActivityIntegration
from sentry.models.group import STATUS_UPDATE_CHOICES
from sentry.models.grouphistory import record_group_history_from_activity_type
from sentry.models.groupinbox import GroupInboxRemoveAction
from sentry.notifications.types import SUBSCRIPTION_REASON_MAP, GroupSubscriptionReason
from sentry.services.hybrid_cloud import coerce_id_from
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.signals import issue_resolved
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.types.activity import ActivityType
from sentry.types.group import SUBSTATUS_UPDATE_CHOICES, GroupSubStatus
from sentry.utils import metrics

from . import ACTIVITIES_COUNT, BULK_MUTATION_LIMIT, SearchFunction, delete_group_list
from .validators import GroupValidator, ValidationError


def handle_discard(
    request: Request,
    group_list: Sequence[Group],
    projects: Sequence[Project],
    user: User,
) -> Response:
    for project in projects:
        if not features.has("projects:discard-groups", project, actor=user):
            return Response({"detail": ["You do not have that feature enabled"]}, status=400)

    if any(group.issue_category != GroupCategory.ERROR for group in group_list):
        raise rest_framework.exceptions.ValidationError(
            detail="Only error issues can be discarded.", code=400
        )
    # grouped by project_id
    groups_to_delete = defaultdict(list)

    for group in group_list:
        with transaction.atomic():
            try:
                tombstone = GroupTombstone.objects.create(
                    previous_group_id=group.id,
                    actor_id=coerce_id_from(user),
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
    acting_user: User | RpcUser | None, group: Group
) -> ActorTuple | None:
    # Used during issue resolution to assign to acting user
    # returns None if the user didn't elect to self assign on resolution
    # or the group is assigned already, otherwise returns Actor
    # representation of current user
    if acting_user:
        GroupSubscription.objects.subscribe(
            user=acting_user, group=group, reason=GroupSubscriptionReason.status_change
        )

        user_options = user_option_service.get_many(
            filter={"user_ids": [acting_user.id], "keys": ["self_assign_issue"]}
        )
        self_assign_issue = "0" if len(user_options) <= 0 else user_options[0].value
        if self_assign_issue == "1" and not group.assignee_set.exists():
            return ActorTuple(type=User, id=acting_user.id)
    return None


def get_current_release_version_of_group(
    group: Group, follows_semver: bool = False
) -> Release | None:
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
        try:
            # This sets current_release_version to the latest semver version associated with a group
            order_by_semver_desc = [f"-{col}" for col in Release.SEMVER_COLS]
            current_release_version = (
                Release.objects.filter_to_semver()
                .filter(
                    id__in=GroupRelease.objects.filter(
                        project_id=group.project.id, group_id=group.id
                    ).values_list("release_id"),
                )
                .annotate_prerelease_column()
                .order_by(*order_by_semver_desc)
                .values_list("version", flat=True)[:1]
                .get()
            )
        except Release.DoesNotExist:
            pass
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
    group_ids: Sequence[Group],
    projects: Sequence[Project],
    organization_id: int,
    search_fn: SearchFunction | None,
    user: User | None = None,
    data: Mapping[str, Any] | None = None,
) -> Response:
    # If `user` and `data` are passed as parameters then they should override
    # the values in `request`.
    user = user or request.user
    data = data or request.data

    if group_ids:
        group_list = Group.objects.filter(
            project__organization_id=organization_id, project__in=projects, id__in=group_ids
        )
        # filter down group ids to only valid matches
        group_ids = [g.id for g in group_list]
        if not group_ids:
            return Response(status=204)
    else:
        group_list = None

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
            raise serializers.ValidationError(serializer.errors, code=400)

    if serializer is None:
        return

    result = dict(serializer.validated_data)

    # so we won't have to requery for each group
    project_lookup = {p.id: p for p in projects}

    acting_user = user if user.is_authenticated else None

    if search_fn and not group_ids:
        try:
            cursor_result, _ = search_fn(
                {
                    "limit": BULK_MUTATION_LIMIT,
                    "paginator_options": {"max_limit": BULK_MUTATION_LIMIT},
                }
            )
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=400)

        group_list = list(cursor_result)
        group_ids = [g.id for g in group_list]

    is_bulk = len(group_ids) > 1

    group_project_ids = {g.project_id for g in group_list}
    # filter projects down to only those that have groups in the search results
    projects = [p for p in projects if p.id in group_project_ids]

    queryset = Group.objects.filter(id__in=group_ids)

    discard = result.get("discard")
    if discard:

        return handle_discard(request, list(queryset), projects, acting_user)

    status_details = result.pop("statusDetails", result)
    status = result.get("status")
    release = None
    commit = None
    res_type = None
    activity_type = None
    activity_data: MutableMapping[str, Any | None] | None = None
    if status in ("resolved", "resolvedInNextRelease"):
        res_status = None
        if status == "resolvedInNextRelease" or status_details.get("inNextRelease"):
            # TODO(jess): We may want to support this for multi project, but punting on it for now
            if len(projects) > 1:
                return Response(
                    {"detail": "Cannot set resolved in next release for multiple projects."},
                    status=400,
                )
            release = (
                status_details.get("inNextRelease")
                or Release.objects.filter(
                    projects=projects[0], organization_id=projects[0].organization_id
                )
                .extra(select={"sort": "COALESCE(date_released, date_added)"})
                .order_by("-sort")[0]
            )
            activity_type = ActivityType.SET_RESOLVED_IN_RELEASE.value
            activity_data = {
                # no version yet
                "version": ""
            }

            serialized_user = user_service.serialize_many(
                filter=dict(user_ids=[user.id]), as_user=user
            )
            new_status_details = {
                "inNextRelease": True,
            }
            if serialized_user:
                new_status_details["actor"] = serialized_user[0]
            res_type = GroupResolution.Type.in_next_release
            res_type_str = "in_next_release"
            res_status = GroupResolution.Status.pending
        elif status_details.get("inRelease"):
            # TODO(jess): We could update validation to check if release
            # applies to multiple projects, but I think we agreed to punt
            # on this for now
            if len(projects) > 1:
                return Response(
                    {"detail": "Cannot set resolved in release for multiple projects."}, status=400
                )
            release = status_details["inRelease"]
            activity_type = ActivityType.SET_RESOLVED_IN_RELEASE.value
            activity_data = {
                # no version yet
                "version": release.version
            }

            serialized_user = user_service.serialize_many(
                filter=dict(user_ids=[user.id]), as_user=user
            )
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
                return Response(
                    {"detail": "Cannot set resolved in commit for multiple projects."}, status=400
                )
            commit = status_details["inCommit"]
            activity_type = ActivityType.SET_RESOLVED_IN_COMMIT.value
            activity_data = {"commit": commit.id}
            serialized_user = user_service.serialize_many(
                filter=dict(user_ids=[user.id]), as_user=user
            )

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

        now = timezone.now()
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
                release = (
                    Release.objects.filter(projects__in=projects, releasecommit__commit=commit)
                    .extra(select={"sort": "COALESCE(date_released, date_added)"})
                    .order_by("-sort")[0]
                )
                res_type = GroupResolution.Type.in_release
                res_status = GroupResolution.Status.resolved
            except IndexError:
                release = None
        for group in group_list:
            with transaction.atomic():
                resolution = None
                created = None
                if release:
                    resolution_params = {
                        "release": release,
                        "type": res_type,
                        "status": res_status,
                        "actor_id": user.id if user.is_authenticated else None,
                    }

                    # We only set `current_release_version` if GroupResolution type is
                    # in_next_release, because we need to store information about the latest/most
                    # recent release that was associated with a group and that is required for
                    # release comparisons (i.e. handling regressions)
                    if res_type == GroupResolution.Type.in_next_release:
                        # Check if semver versioning scheme is followed
                        follows_semver = follows_semver_versioning_scheme(
                            org_id=group.organization.id,
                            project_id=group.project.id,
                            release_version=release.version,
                        )

                        current_release_version = get_current_release_version_of_group(
                            group=group, follows_semver=follows_semver
                        )
                        if current_release_version:
                            resolution_params.update(
                                {"current_release_version": current_release_version}
                            )

                            # Sets `current_release_version` for activity, since there is no point
                            # waiting for when a new release is created i.e.
                            # clear_expired_resolutions task to be run.
                            # Activity should look like "... resolved in version
                            # >current_release_version" in the UI
                            if follows_semver:
                                activity_data.update(
                                    {"current_release_version": current_release_version}
                                )

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
                                        organization_id=projects[0].organization_id,
                                    )

                                    date_order_q = Q(
                                        date_added__gt=current_release_obj.date_added
                                    ) | Q(
                                        date_added=current_release_obj.date_added,
                                        id__gt=current_release_obj.id,
                                    )

                                    # Find the next release after the current_release_version
                                    # i.e. the release that resolves the issue
                                    resolved_in_release = (
                                        Release.objects.filter(
                                            date_order_q,
                                            projects=projects[0],
                                            organization_id=projects[0].organization_id,
                                        )
                                        .extra(
                                            select={"sort": "COALESCE(date_released, date_added)"}
                                        )
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
                        resolution.update(datetime=timezone.now(), **resolution_params)

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
                    created = affected

                group.status = GroupStatus.RESOLVED
                group.substatus = None
                group.resolved_at = now
                remove_group_from_inbox(
                    group, action=GroupInboxRemoveAction.RESOLVED, user=acting_user
                )
                result["inbox"] = None

                assigned_to = self_subscribe_and_assign_issue(acting_user, group)
                if assigned_to is not None:
                    result["assignedTo"] = assigned_to

                if created:
                    activity = Activity.objects.create(
                        project=project_lookup[group.project_id],
                        group=group,
                        type=activity_type,
                        user_id=acting_user.id,
                        ident=resolution.id if resolution else None,
                        data=activity_data,
                    )
                    record_group_history_from_activity_type(group, activity_type, actor=acting_user)

                    # TODO(dcramer): we need a solution for activity rollups
                    # before sending notifications on bulk changes
                    if not is_bulk:
                        activity.send_notification()

            issue_resolved.send_robust(
                organization_id=organization_id,
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

    elif status:
        new_status = STATUS_UPDATE_CHOICES[result["status"]]
        new_substatus = (
            SUBSTATUS_UPDATE_CHOICES[result.get("substatus")] if result.get("substatus") else None
        )
        if new_substatus is None and new_status == GroupStatus.UNRESOLVED:
            new_substatus = GroupSubStatus.ONGOING

        has_escalating_issues = features.has(
            "organizations:escalating-issues", group_list[0].organization
        )

        with transaction.atomic():
            # TODO(gilbert): update() doesn't call pre_save and bypasses any substatus defaulting we have there
            #                we should centralize the logic for validating and defaulting substatus values
            #                and refactor pre_save and the above new_substatus assignment to account for this
            status_updated = queryset.exclude(status=new_status).update(
                status=new_status, substatus=new_substatus
            )
            GroupResolution.objects.filter(group__in=group_ids).delete()
            if new_status == GroupStatus.IGNORED:
                if new_substatus == GroupSubStatus.UNTIL_ESCALATING and has_escalating_issues:
                    result["statusDetails"] = handle_archived_until_escalating(
                        group_list, acting_user, projects, sender=update_groups
                    )
                else:
                    result["statusDetails"] = handle_ignored(
                        group_ids, group_list, status_details, acting_user, user
                    )
                result["inbox"] = None
            else:
                result["statusDetails"] = {}
        if group_list and status_updated:
            activity_type, activity_data = handle_status_update(
                group_list=group_list,
                projects=projects,
                project_lookup=project_lookup,
                new_status=new_status,
                new_substatus=new_substatus,
                is_bulk=is_bulk,
                acting_user=acting_user,
                status_details=result.get("statusDetails", {}),
                sender=update_groups,
                activity_type=activity_type,
            )

    # XXX (ahmed): hack to get the activities to work properly on issues page. Not sure of
    # what performance impact this might have & this possibly should be moved else where
    try:
        if len(group_list) == 1:
            if res_type in (
                GroupResolution.Type.in_next_release,
                GroupResolution.Type.in_release,
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
        assigned_actor = result["assignedTo"]
        assigned_by = (
            data.get("assignedBy")
            if data.get("assignedBy") in ["assignee_selector", "suggested_assignee"]
            else None
        )
        extra = (
            {"integration": data.get("integration")}
            if data.get("integration")
            in [ActivityIntegration.SLACK.value, ActivityIntegration.MSTEAMS.value]
            else dict()
        )
        if assigned_actor:
            for group in group_list:
                resolved_actor: RpcUser | Team = assigned_actor.resolve()

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
            result["assignedTo"] = serialize(
                assigned_actor.resolve(), acting_user, ActorSerializer()
            )

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

    handle_has_seen(
        result.get("hasSeen"), group_list, group_ids, project_lookup, projects, acting_user
    )

    if "isBookmarked" in result:
        handle_is_bookmarked(
            result["isBookmarked"], group_list, group_ids, project_lookup, acting_user
        )

    if result.get("isSubscribed") in (True, False):
        result["subscriptionDetails"] = handle_is_subscribed(
            result["isSubscribed"], group_list, project_lookup, acting_user
        )

    if "isPublic" in result:
        result["shareId"] = handle_is_public(
            result["isPublic"], group_list, project_lookup, acting_user
        )

    # XXX(dcramer): this feels a bit shady like it should be its own endpoint.
    if result.get("merge") and len(group_list) > 1:
        # don't allow merging cross project
        if len(projects) > 1:
            return Response({"detail": "Merging across multiple projects is not supported"})

        result["merge"] = handle_merge(group_list, project_lookup, acting_user)

    inbox = result.get("inbox", None)
    if inbox is not None:
        result["inbox"] = update_inbox(
            inbox,
            group_list,
            project_lookup,
            acting_user,
            http_referrer=request.META.get("HTTP_REFERER"),
            sender=update_groups,
        )

    return Response(result)


def handle_is_subscribed(
    is_subscribed: bool,
    group_list: Sequence[Group],
    project_lookup: dict[int, Any],
    acting_user: User,
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
            user_id=acting_user.id,
            group=group,
            project=project_lookup[group.project_id],
            values={"is_active": is_subscribed, "reason": GroupSubscriptionReason.unknown},
        )

    return {"reason": SUBSCRIPTION_REASON_MAP.get(GroupSubscriptionReason.unknown, "unknown")}


def handle_is_bookmarked(
    is_bookmarked: bool,
    group_list: Sequence[Group],
    group_ids: Sequence[Group],
    project_lookup: Dict[int, Project],
    acting_user: User | None,
) -> None:
    """
    Creates bookmarks and subscriptions for a user, or deletes the exisitng bookmarks.
    """
    if is_bookmarked:
        for group in group_list:
            GroupBookmark.objects.get_or_create(
                project=project_lookup[group.project_id],
                group=group,
                user_id=acting_user.id if acting_user else None,
            )
            GroupSubscription.objects.subscribe(
                user=acting_user, group=group, reason=GroupSubscriptionReason.bookmark
            )
    elif is_bookmarked is False:
        GroupBookmark.objects.filter(
            group__in=group_ids,
            user_id=acting_user.id if acting_user else None,
        ).delete()


def handle_has_seen(
    has_seen: Any,
    group_list: Sequence[Group],
    group_ids: Sequence[Group],
    project_lookup: dict[int, Project],
    projects: Sequence[Project],
    acting_user: User | None,
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
                instance, created = create_or_update(
                    GroupSeen,
                    group=group,
                    user_id=user_id,
                    project=project_lookup[group.project_id],
                    values={"last_seen": timezone.now()},
                )
    elif has_seen is False:
        GroupSeen.objects.filter(group__in=group_ids, user_id=user_id).delete()


def handle_is_public(
    is_public: bool,
    group_list: list[Group],
    project_lookup: dict[int, Project],
    acting_user: User | None,
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
        if GroupShare.objects.filter(group=group).delete():
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
