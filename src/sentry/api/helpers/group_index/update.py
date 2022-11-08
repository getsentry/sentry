from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Any, Mapping, MutableMapping, Sequence
from uuid import uuid4

import rest_framework
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, eventstream, features
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.db.models.query import create_or_update
from sentry.models import (
    TOMBSTONE_FIELDS_FROM_GROUP,
    Activity,
    ActorTuple,
    Group,
    GroupAssignee,
    GroupBookmark,
    GroupHash,
    GroupInboxReason,
    GroupLink,
    GroupRelease,
    GroupResolution,
    GroupSeen,
    GroupShare,
    GroupSnooze,
    GroupStatus,
    GroupSubscription,
    GroupTombstone,
    Project,
    Release,
    User,
    UserOption,
    follows_semver_versioning_scheme,
    remove_group_from_inbox,
)
from sentry.models.activity import ActivityIntegration
from sentry.models.group import STATUS_UPDATE_CHOICES
from sentry.models.grouphistory import record_group_history_from_activity_type
from sentry.models.groupinbox import GroupInboxRemoveAction, add_group_to_inbox
from sentry.notifications.types import SUBSCRIPTION_REASON_MAP, GroupSubscriptionReason
from sentry.signals import (
    issue_ignored,
    issue_mark_reviewed,
    issue_resolved,
    issue_unignored,
    issue_unresolved,
)
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.tasks.merge import merge_groups
from sentry.types.activity import ActivityType
from sentry.types.issues import GroupCategory
from sentry.utils import metrics
from sentry.utils.functional import extract_lazy_object

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

    if any(group.issue_category == GroupCategory.PERFORMANCE for group in group_list):
        raise rest_framework.exceptions.ValidationError(
            detail="Cannot discard performance issues.", code=400
        )
    # grouped by project_id
    groups_to_delete = defaultdict(list)

    for group in group_list:
        with transaction.atomic():
            try:
                tombstone = GroupTombstone.objects.create(
                    previous_group_id=group.id,
                    actor_id=user.id if user else None,
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


def self_subscribe_and_assign_issue(acting_user: User | None, group: Group) -> ActorTuple | None:
    # Used during issue resolution to assign to acting user
    # returns None if the user didn't elect to self assign on resolution
    # or the group is assigned already, otherwise returns Actor
    # representation of current user
    if acting_user:
        GroupSubscription.objects.subscribe(
            user=acting_user, group=group, reason=GroupSubscriptionReason.status_change
        )
        self_assign_issue = UserOption.objects.get_value(
            user=acting_user, key="self_assign_issue", default="0"
        )
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

    statusDetails = result.pop("statusDetails", result)
    status = result.get("status")
    release = None
    commit = None
    res_type = None
    activity_type = None
    activity_data: MutableMapping[str, Any | None] | None = None
    if status in ("resolved", "resolvedInNextRelease"):
        res_status = None
        if status == "resolvedInNextRelease" or statusDetails.get("inNextRelease"):
            # TODO(jess): We may want to support this for multi project, but punting on it for now
            if len(projects) > 1:
                return Response(
                    {"detail": "Cannot set resolved in next release for multiple projects."},
                    status=400,
                )
            release = (
                statusDetails.get("inNextRelease")
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
            status_details = {
                "inNextRelease": True,
                "actor": serialize(extract_lazy_object(user), user),
            }
            res_type = GroupResolution.Type.in_next_release
            res_type_str = "in_next_release"
            res_status = GroupResolution.Status.pending
        elif statusDetails.get("inRelease"):
            # TODO(jess): We could update validation to check if release
            # applies to multiple projects, but I think we agreed to punt
            # on this for now
            if len(projects) > 1:
                return Response(
                    {"detail": "Cannot set resolved in release for multiple projects."}, status=400
                )
            release = statusDetails["inRelease"]
            activity_type = ActivityType.SET_RESOLVED_IN_RELEASE.value
            activity_data = {
                # no version yet
                "version": release.version
            }
            status_details = {
                "inRelease": release.version,
                "actor": serialize(extract_lazy_object(user), user),
            }
            res_type = GroupResolution.Type.in_release
            res_type_str = "in_release"
            res_status = GroupResolution.Status.resolved
        elif statusDetails.get("inCommit"):
            # TODO(jess): Same here, this is probably something we could do, but
            # punting for now.
            if len(projects) > 1:
                return Response(
                    {"detail": "Cannot set resolved in commit for multiple projects."}, status=400
                )
            commit = statusDetails["inCommit"]
            activity_type = ActivityType.SET_RESOLVED_IN_COMMIT.value
            activity_data = {"commit": commit.id}
            status_details = {
                "inCommit": serialize(commit, user),
                "actor": serialize(extract_lazy_object(user), user),
            }
            res_type_str = "in_commit"
        else:
            res_type_str = "now"
            activity_type = ActivityType.SET_RESOLVED.value
            activity_data = {}
            status_details = {}

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
                    status=GroupStatus.RESOLVED, resolved_at=now
                )
                if not resolution:
                    created = affected

                group.status = GroupStatus.RESOLVED
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
                        user=acting_user,
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
                user=acting_user or user,
                group=group,
                project=project_lookup[group.project_id],
                resolution_type=res_type_str,
                sender=update_groups,
            )

            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group.project_id, "group_id": group.id}
            )

        result.update({"status": "resolved", "statusDetails": status_details})

    elif status:
        new_status = STATUS_UPDATE_CHOICES[result["status"]]
        ignore_duration = None
        ignore_count = None
        ignore_window = None
        ignore_user_count = None
        ignore_user_window = None
        ignore_until = None

        with transaction.atomic():
            happened = queryset.exclude(status=new_status).update(status=new_status)

            GroupResolution.objects.filter(group__in=group_ids).delete()
            if new_status == GroupStatus.IGNORED:
                metrics.incr("group.ignored", skip_internal=True)
                for group in group_ids:
                    remove_group_from_inbox(
                        group, action=GroupInboxRemoveAction.IGNORED, user=acting_user
                    )
                result["inbox"] = None

                ignore_duration = (
                    statusDetails.pop("ignoreDuration", None)
                    or statusDetails.pop("snoozeDuration", None)
                ) or None
                ignore_count = statusDetails.pop("ignoreCount", None) or None
                ignore_window = statusDetails.pop("ignoreWindow", None) or None
                ignore_user_count = statusDetails.pop("ignoreUserCount", None) or None
                ignore_user_window = statusDetails.pop("ignoreUserWindow", None) or None
                if ignore_duration or ignore_count or ignore_user_count:
                    if ignore_duration:
                        ignore_until = timezone.now() + timedelta(minutes=ignore_duration)
                    else:
                        ignore_until = None
                    for group in group_list:
                        state = {}
                        if ignore_count and not ignore_window:
                            state["times_seen"] = group.times_seen
                        if ignore_user_count and not ignore_user_window:
                            state["users_seen"] = group.count_users_seen()
                        GroupSnooze.objects.create_or_update(
                            group=group,
                            values={
                                "until": ignore_until,
                                "count": ignore_count,
                                "window": ignore_window,
                                "user_count": ignore_user_count,
                                "user_window": ignore_user_window,
                                "state": state,
                                "actor_id": user.id if user.is_authenticated else None,
                            },
                        )
                        result["statusDetails"] = {
                            "ignoreCount": ignore_count,
                            "ignoreUntil": ignore_until,
                            "ignoreUserCount": ignore_user_count,
                            "ignoreUserWindow": ignore_user_window,
                            "ignoreWindow": ignore_window,
                            "actor": serialize(extract_lazy_object(user), user),
                        }
                else:
                    GroupSnooze.objects.filter(group__in=group_ids).delete()
                    ignore_until = None
                    result["statusDetails"] = {}
            else:
                result["statusDetails"] = {}
        if group_list and happened:
            if new_status == GroupStatus.UNRESOLVED:
                activity_type = ActivityType.SET_UNRESOLVED.value
                activity_data = {}

                for group in group_list:
                    if group.status == GroupStatus.IGNORED:
                        issue_unignored.send_robust(
                            project=project_lookup[group.project_id],
                            user=acting_user,
                            group=group,
                            transition_type="manual",
                            sender=update_groups,
                        )
                    else:
                        issue_unresolved.send_robust(
                            project=project_lookup[group.project_id],
                            user=acting_user,
                            group=group,
                            transition_type="manual",
                            sender=update_groups,
                        )
            elif new_status == GroupStatus.IGNORED:
                activity_type = ActivityType.SET_IGNORED.value
                activity_data = {
                    "ignoreCount": ignore_count,
                    "ignoreDuration": ignore_duration,
                    "ignoreUntil": ignore_until,
                    "ignoreUserCount": ignore_user_count,
                    "ignoreUserWindow": ignore_user_window,
                    "ignoreWindow": ignore_window,
                }

                groups_by_project_id = defaultdict(list)
                for group in group_list:
                    groups_by_project_id[group.project_id].append(group)

                for project in projects:
                    project_groups = groups_by_project_id.get(project.id)
                    if project_groups:
                        issue_ignored.send_robust(
                            project=project,
                            user=acting_user,
                            group_list=project_groups,
                            activity_data=activity_data,
                            sender=update_groups,
                        )

            for group in group_list:
                group.status = new_status

                activity = Activity.objects.create(
                    project=project_lookup[group.project_id],
                    group=group,
                    type=activity_type,
                    user=acting_user,
                    data=activity_data,
                )
                record_group_history_from_activity_type(group, activity_type, actor=acting_user)

                # TODO(dcramer): we need a solution for activity rollups
                # before sending notifications on bulk changes
                if not is_bulk:
                    if acting_user:
                        GroupSubscription.objects.subscribe(
                            user=acting_user,
                            group=group,
                            reason=GroupSubscriptionReason.status_change,
                        )
                    activity.send_notification()

                if new_status == GroupStatus.UNRESOLVED:
                    kick_off_status_syncs.apply_async(
                        kwargs={"project_id": group.project_id, "group_id": group.id}
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
                resolved_actor = assigned_actor.resolve()

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
    is_member_map = {
        project.id: project.member_set.filter(user=acting_user).exists() for project in projects
    }
    if result.get("hasSeen"):
        for group in group_list:
            if is_member_map.get(group.project_id):
                instance, created = create_or_update(
                    GroupSeen,
                    group=group,
                    user=acting_user,
                    project=project_lookup[group.project_id],
                    values={"last_seen": timezone.now()},
                )
    elif result.get("hasSeen") is False:
        GroupSeen.objects.filter(group__in=group_ids, user=acting_user).delete()

    if result.get("isBookmarked"):
        for group in group_list:
            GroupBookmark.objects.get_or_create(
                project=project_lookup[group.project_id], group=group, user=acting_user
            )
            GroupSubscription.objects.subscribe(
                user=acting_user, group=group, reason=GroupSubscriptionReason.bookmark
            )
    elif result.get("isBookmarked") is False:
        GroupBookmark.objects.filter(group__in=group_ids, user=acting_user).delete()

    # TODO(dcramer): we could make these more efficient by first
    # querying for rich rows are present (if N > 2), flipping the flag
    # on those rows, and then creating the missing rows
    if result.get("isSubscribed") in (True, False):
        is_subscribed = result["isSubscribed"]
        for group in group_list:
            # NOTE: Subscribing without an initiating event (assignment,
            # commenting, etc.) clears out the previous subscription reason
            # to avoid showing confusing messaging as a result of this
            # action. It'd be jarring to go directly from "you are not
            # subscribed" to "you were subscribed due since you were
            # assigned" just by clicking the "subscribe" button (and you
            # may no longer be assigned to the issue anyway.)
            GroupSubscription.objects.create_or_update(
                user=acting_user,
                group=group,
                project=project_lookup[group.project_id],
                values={"is_active": is_subscribed, "reason": GroupSubscriptionReason.unknown},
            )

        result["subscriptionDetails"] = {
            "reason": SUBSCRIPTION_REASON_MAP.get(GroupSubscriptionReason.unknown, "unknown")
        }

    if "isPublic" in result:
        # We always want to delete an existing share, because triggering
        # an isPublic=True even when it's already public, should trigger
        # regenerating.
        for group in group_list:
            if GroupShare.objects.filter(group=group).delete():
                result["shareId"] = None
                Activity.objects.create(
                    project=project_lookup[group.project_id],
                    group=group,
                    type=ActivityType.SET_PRIVATE.value,
                    user=acting_user,
                )

    if result.get("isPublic"):
        for group in group_list:
            share, created = GroupShare.objects.get_or_create(
                project=project_lookup[group.project_id], group=group, user=acting_user
            )
            if created:
                result["shareId"] = share.uuid
                Activity.objects.create(
                    project=project_lookup[group.project_id],
                    group=group,
                    type=ActivityType.SET_PUBLIC.value,
                    user=acting_user,
                )

    # XXX(dcramer): this feels a bit shady like it should be its own endpoint.
    if result.get("merge") and len(group_list) > 1:
        # don't allow merging cross project
        if len(projects) > 1:
            return Response({"detail": "Merging across multiple projects is not supported"})

        if any([group.issue_category == GroupCategory.PERFORMANCE for group in group_list]):
            raise rest_framework.exceptions.ValidationError(
                detail="Cannot merge performance issues.", code=400
            )

        group_list_by_times_seen = sorted(
            group_list, key=lambda g: (g.times_seen, g.id), reverse=True
        )
        primary_group, groups_to_merge = group_list_by_times_seen[0], group_list_by_times_seen[1:]

        group_ids_to_merge = [g.id for g in groups_to_merge]
        eventstream_state = eventstream.start_merge(
            primary_group.project_id, group_ids_to_merge, primary_group.id
        )

        Group.objects.filter(id__in=group_ids_to_merge).update(status=GroupStatus.PENDING_MERGE)

        transaction_id = uuid4().hex
        merge_groups.delay(
            from_object_ids=group_ids_to_merge,
            to_object_id=primary_group.id,
            transaction_id=transaction_id,
            eventstream_state=eventstream_state,
        )

        Activity.objects.create(
            project=project_lookup[primary_group.project_id],
            group=primary_group,
            type=ActivityType.MERGE.value,
            user=acting_user,
            data={"issues": [{"id": c.id} for c in groups_to_merge]},
        )

        result["merge"] = {
            "parent": str(primary_group.id),
            "children": [str(g.id) for g in groups_to_merge],
        }

    # Support moving groups in or out of the inbox
    inbox = result.get("inbox", None)
    if inbox is not None:
        if inbox:
            for group in group_list:
                add_group_to_inbox(group, GroupInboxReason.MANUAL)
        elif not inbox:
            for group in group_list:
                remove_group_from_inbox(
                    group,
                    action=GroupInboxRemoveAction.MARK_REVIEWED,
                    user=acting_user,
                    referrer=request.META.get("HTTP_REFERER"),
                )
                issue_mark_reviewed.send_robust(
                    project=project_lookup[group.project_id],
                    user=acting_user,
                    group=group,
                    sender=update_groups,
                )
        result["inbox"] = inbox

    return Response(result)
