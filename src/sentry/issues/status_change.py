from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Sequence

from django.db import transaction
from django.db.models import Q
from django.db.models.signals import post_save
from django.utils import timezone
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.models import (
    Activity,
    ActorTuple,
    Group,
    GroupLink,
    GroupRelease,
    GroupResolution,
    GroupStatus,
    GroupSubscription,
    Project,
    Release,
    User,
    follows_semver_versioning_scheme,
    record_group_history_from_activity_type,
    remove_group_from_inbox,
)
from sentry.models.groupinbox import GroupInboxRemoveAction
from sentry.notifications.types import GroupSubscriptionReason
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.signals import issue_ignored, issue_resolved, issue_unignored, issue_unresolved
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils import json, metrics


def handle_resolved_status(
    status,
    status_details,
    projects,
    user,
    acting_user,
    organization_id,
    group_list,
    project_lookup,
    update_groups,
    is_bulk,
):

    (
        release,
        res_type,
        res_type_str,
        res_status,
        commit,
        activity_type,
        activity_data,
        new_status_details,
    ) = get_release_data(status, status_details, projects, user)
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

    result = handle_resolved(
        release,
        res_type,
        res_type_str,
        res_status,
        commit,
        activity_type,
        activity_data,
        organization_id,
        group_list,
        projects,
        project_lookup,
        user,
        acting_user,
        is_bulk,
        update_groups,
    )
    result.update({"statusDetails": new_status_details})
    return result


def get_release_data(status, status_details, projects, user):
    release, res_type, res_status, commit = None, None, None, None
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

        serialized_user = user_service.serialize_many(filter=dict(user_ids=[user.id]), as_user=user)
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
            return Response(
                {"detail": "Cannot set resolved in commit for multiple projects."}, status=400
            )
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

    return (
        release,
        res_type,
        res_type_str,
        res_status,
        commit,
        activity_type,
        activity_data,
        new_status_details,
    )


def handle_resolved(
    release,
    res_type,
    res_type_str,
    res_status,
    commit,
    activity_type,
    activity_data,
    organization_id,
    group_list,
    projects,
    project_lookup,
    user,
    acting_user,
    is_bulk,
    update_groups,
):
    now = timezone.now()
    result = {}
    for group in group_list:
        with transaction.atomic():
            resolution = None
            created = None
            if release:
                handle_resolution_with_release(
                    release, res_type, res_status, group, projects, activity_data, user
                )

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
            if affected:
                post_save.send(
                    sender=Group,
                    instance=group,
                    created=False,
                    update_fields=["resolved_at", "status", "substatus"],
                )
            remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED, user=acting_user)
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

    result.update({"status": "resolved"})
    return result


def handle_resolution_with_release(
    release, res_type, res_status, group, projects, activity_data, user
):
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
                        organization_id=projects[0].organization_id,
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
                            projects=projects[0],
                            organization_id=projects[0].organization_id,
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
        resolution.update(datetime=timezone.now(), **resolution_params)


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


def handle_status_update(
    group_list: Sequence[Group],
    projects: Sequence[Project],
    project_lookup: Dict[int, Project],
    new_status: GroupStatus,
    new_substatus: GroupSubStatus | None,
    is_bulk: bool,
    status_details: Dict[str, Any],
    acting_user: User | None,
    activity_type: str | None,
    sender: Any,
) -> ActivityType:
    """
    Update the status for a list of groups and create entries for Activity and GroupHistory.

    Returns a tuple of (activity_type, activity_data) for the activity that was created.
    """
    activity_data = {}
    if new_status == GroupStatus.UNRESOLVED:
        activity_type = ActivityType.SET_UNRESOLVED.value

        for group in group_list:
            if group.status == GroupStatus.IGNORED:
                issue_unignored.send_robust(
                    project=project_lookup[group.project_id],
                    user_id=acting_user.id if acting_user else None,
                    group=group,
                    transition_type="manual",
                    sender=sender,
                )
            else:
                issue_unresolved.send_robust(
                    project=project_lookup[group.project_id],
                    user=acting_user,
                    group=group,
                    transition_type="manual",
                    sender=sender,
                )
    elif new_status == GroupStatus.IGNORED:
        ignore_duration = (
            status_details.pop("ignoreDuration", None) or status_details.pop("snoozeDuration", None)
        ) or None
        activity_type = ActivityType.SET_IGNORED.value
        activity_data = {
            "ignoreCount": status_details.get("ignoreCount", None),
            "ignoreDuration": ignore_duration,
            "ignoreUntil": status_details.get("ignoreUntil", None),
            "ignoreUserCount": status_details.get("ignoreUserCount", None),
            "ignoreUserWindow": status_details.get("ignoreUserWindow", None),
            "ignoreWindow": status_details.get("ignoreWindow", None),
            "ignoreUntilEscalating": status_details.get("ignoreUntilEscalating", None),
        }
        if activity_data["ignoreUntil"] is not None:
            activity_data["ignoreUntil"] = json.datetime_to_str(activity_data["ignoreUntil"])

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
                    sender=sender,
                )

    for group in group_list:
        group.status = new_status
        group.substatus = new_substatus

        activity = Activity.objects.create(
            project=project_lookup[group.project_id],
            group=group,
            type=activity_type,
            user_id=acting_user.id if acting_user else None,
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

    return activity_type
