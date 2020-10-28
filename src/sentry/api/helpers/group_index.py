from __future__ import absolute_import

import logging
import six

from collections import defaultdict
from datetime import timedelta
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.utils import timezone

from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import eventstream, features
from sentry.app import ratelimiter
from sentry.api.base import audit_logger
from sentry.api.fields import Actor, ActorField
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.api.serializers.models.group import SUBSCRIPTION_REASON_MAP
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.db.models.query import create_or_update
from sentry.models import (
    Activity,
    Commit,
    Group,
    GroupAssignee,
    GroupHash,
    GroupInbox,
    GroupInboxReason,
    GroupLink,
    GroupStatus,
    GroupTombstone,
    GroupResolution,
    GroupBookmark,
    GroupSeen,
    GroupShare,
    GroupSnooze,
    GroupSubscription,
    GroupSubscriptionReason,
    Release,
    Repository,
    TOMBSTONE_FIELDS_FROM_GROUP,
    Team,
    User,
    UserOption,
)
from sentry.models.groupinbox import add_group_to_inbox
from sentry.models.group import looks_like_short_id
from sentry.api.issue_search import convert_query_values, InvalidSearchQuery, parse_search_query
from sentry.signals import (
    issue_deleted,
    issue_ignored,
    issue_unignored,
    issue_resolved,
    issue_unresolved,
    advanced_search_feature_gated,
)
from sentry.tasks.deletion import delete_groups as delete_groups_task
from sentry.utils.hashlib import md5_text
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.tasks.merge import merge_groups
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry
from sentry.utils.cursors import Cursor
from sentry.utils.functional import extract_lazy_object
from sentry.utils.compat import zip

delete_logger = logging.getLogger("sentry.deletions.api")


class ValidationError(Exception):
    pass


def build_query_params_from_request(request, organization, projects, environments):
    query_kwargs = {"projects": projects, "sort_by": request.GET.get("sort", DEFAULT_SORT_OPTION)}

    limit = request.GET.get("limit")
    if limit:
        try:
            query_kwargs["limit"] = int(limit)
        except ValueError:
            raise ValidationError("invalid limit")

    # TODO: proper pagination support
    if request.GET.get("cursor"):
        try:
            query_kwargs["cursor"] = Cursor.from_string(request.GET.get("cursor"))
        except ValueError:
            raise ParseError(detail="Invalid cursor parameter.")
    query = request.GET.get("query", "is:unresolved").strip()
    if query:
        try:
            search_filters = convert_query_values(
                parse_search_query(query), projects, request.user, environments
            )
        except InvalidSearchQuery as e:
            raise ValidationError(
                u"Your search query could not be parsed: {}".format(six.text_type(e))
            )

        validate_search_filter_permissions(organization, search_filters, request.user)
        query_kwargs["search_filters"] = search_filters

    return query_kwargs


# List of conditions that mark a SearchFilter as an advanced search. Format is
# (lambda SearchFilter(): <boolean condition>, '<feature_name')
advanced_search_features = [
    (lambda search_filter: search_filter.is_negation, "negative search"),
    (lambda search_filter: search_filter.value.is_wildcard(), "wildcard search"),
]


def validate_search_filter_permissions(organization, search_filters, user):
    """
    Verifies that an organization is allowed to perform the query that they
    submitted.
    If the org is using a feature they don't have access to, raises
    `ValidationError` with information which part of the query they don't have
    access to.
    :param search_filters:
    """
    # If the organization has advanced search, then no need to perform any
    # other checks since they're allowed to use all search features
    if features.has("organizations:advanced-search", organization):
        return

    for search_filter in search_filters:
        for feature_condition, feature_name in advanced_search_features:
            if feature_condition(search_filter):
                advanced_search_feature_gated.send_robust(
                    user=user, organization=organization, sender=validate_search_filter_permissions
                )
                raise ValidationError(
                    u"You need access to the advanced search feature to use {}".format(feature_name)
                )


def get_by_short_id(organization_id, is_short_id_lookup, query):
    if is_short_id_lookup == "1" and looks_like_short_id(query):
        try:
            return Group.objects.by_qualified_short_id(organization_id, query)
        except Group.DoesNotExist:
            pass


STATUS_CHOICES = {
    "resolved": GroupStatus.RESOLVED,
    "unresolved": GroupStatus.UNRESOLVED,
    "ignored": GroupStatus.IGNORED,
    "resolvedInNextRelease": GroupStatus.UNRESOLVED,
    # TODO(dcramer): remove in 9.0
    "muted": GroupStatus.IGNORED,
}


class InCommitValidator(serializers.Serializer):
    commit = serializers.CharField(required=True)
    repository = serializers.CharField(required=True)

    def validate_repository(self, value):
        project = self.context["project"]
        try:
            value = Repository.objects.get(organization_id=project.organization_id, name=value)
        except Repository.DoesNotExist:
            raise serializers.ValidationError("Unable to find the given repository.")
        return value

    def validate(self, attrs):
        attrs = super(InCommitValidator, self).validate(attrs)
        repository = attrs.get("repository")
        commit = attrs.get("commit")
        if not repository:
            raise serializers.ValidationError(
                {"repository": ["Unable to find the given repository."]}
            )
        if not commit:
            raise serializers.ValidationError({"commit": ["Unable to find the given commit."]})
        try:
            commit = Commit.objects.get(repository_id=repository.id, key=commit)
        except Commit.DoesNotExist:
            raise serializers.ValidationError({"commit": ["Unable to find the given commit."]})
        return commit


class StatusDetailsValidator(serializers.Serializer):
    inNextRelease = serializers.BooleanField()
    inRelease = serializers.CharField()
    inCommit = InCommitValidator(required=False)
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)

    def validate_inRelease(self, value):
        project = self.context["project"]
        if value == "latest":
            try:
                value = (
                    Release.objects.filter(
                        projects=project, organization_id=project.organization_id
                    )
                    .extra(select={"sort": "COALESCE(date_released, date_added)"})
                    .order_by("-sort")[0]
                )
            except IndexError:
                raise serializers.ValidationError(
                    "No release data present in the system to form a basis for 'Next Release'"
                )
        else:
            try:
                value = Release.objects.get(
                    projects=project, organization_id=project.organization_id, version=value
                )
            except Release.DoesNotExist:
                raise serializers.ValidationError(
                    "Unable to find a release with the given version."
                )
        return value

    def validate_inNextRelease(self, value):
        project = self.context["project"]
        try:
            value = (
                Release.objects.filter(projects=project, organization_id=project.organization_id)
                .extra(select={"sort": "COALESCE(date_released, date_added)"})
                .order_by("-sort")[0]
            )
        except IndexError:
            raise serializers.ValidationError(
                "No release data present in the system to form a basis for 'Next Release'"
            )
        return value


class InboxDetailsValidator(serializers.Serializer):
    # Support undo / snooze reasons
    pass


class GroupValidator(serializers.Serializer):
    inbox = serializers.BooleanField()
    inboxDetails = InboxDetailsValidator()
    status = serializers.ChoiceField(choices=zip(STATUS_CHOICES.keys(), STATUS_CHOICES.keys()))
    statusDetails = StatusDetailsValidator()
    hasSeen = serializers.BooleanField()
    isBookmarked = serializers.BooleanField()
    isPublic = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()
    merge = serializers.BooleanField()
    discard = serializers.BooleanField()
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    assignedTo = ActorField()

    # TODO(dcramer): remove in 9.0
    # for the moment, the CLI sends this for any issue update, so allow nulls
    snoozeDuration = serializers.IntegerField(allow_null=True)

    def validate_assignedTo(self, value):
        if (
            value
            and value.type is User
            and not self.context["project"].member_set.filter(user_id=value.id).exists()
        ):
            raise serializers.ValidationError("Cannot assign to non-team member")

        if (
            value
            and value.type is Team
            and not self.context["project"].teams.filter(id=value.id).exists()
        ):
            raise serializers.ValidationError(
                "Cannot assign to a team without access to the project"
            )

        return value

    def validate_discard(self, value):
        access = self.context.get("access")
        if value and (not access or not access.has_scope("event:admin")):
            raise serializers.ValidationError("You do not have permission to discard events")
        return value

    def validate(self, attrs):
        attrs = super(GroupValidator, self).validate(attrs)
        if len(attrs) > 1 and "discard" in attrs:
            raise serializers.ValidationError("Other attributes cannot be updated when discarding")
        return attrs


def handle_discard(request, group_list, projects, user):
    for project in projects:
        if not features.has("projects:discard-groups", project, actor=user):
            return Response({"detail": ["You do not have that feature enabled"]}, status=400)

    # grouped by project_id
    groups_to_delete = defaultdict(list)

    for group in group_list:
        with transaction.atomic():
            try:
                tombstone = GroupTombstone.objects.create(
                    previous_group_id=group.id,
                    actor_id=user.id if user else None,
                    **{name: getattr(group, name) for name in TOMBSTONE_FIELDS_FROM_GROUP}
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
        _delete_groups(request, project, groups_to_delete.get(project.id), delete_type="discard")

    return Response(status=204)


def _delete_groups(request, project, group_list, delete_type):
    if not group_list:
        return

    # deterministic sort for sanity, and for very large deletions we'll
    # delete the "smaller" groups first
    group_list.sort(key=lambda g: (g.times_seen, g.id))
    group_ids = [g.id for g in group_list]

    Group.objects.filter(id__in=group_ids).exclude(
        status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]
    ).update(status=GroupStatus.PENDING_DELETION)

    eventstream_state = eventstream.start_delete_groups(project.id, group_ids)
    transaction_id = uuid4().hex

    GroupHash.objects.filter(project_id=project.id, group__id__in=group_ids).delete()

    delete_groups_task.apply_async(
        kwargs={
            "object_ids": group_ids,
            "transaction_id": transaction_id,
            "eventstream_state": eventstream_state,
        },
        countdown=3600,
    )

    for group in group_list:
        create_audit_entry(
            request=request,
            transaction_id=transaction_id,
            logger=audit_logger,
            organization_id=project.organization_id,
            target_object=group.id,
        )

        delete_logger.info(
            "object.delete.queued",
            extra={
                "object_id": group.id,
                "transaction_id": transaction_id,
                "model": type(group).__name__,
            },
        )

        issue_deleted.send_robust(
            group=group, user=request.user, delete_type=delete_type, sender=_delete_groups
        )


def delete_groups(request, projects, organization_id, search_fn):
    """
    `search_fn` refers to the `search.query` method with the appropriate
    project, org, environment, and search params already bound
    """
    group_ids = request.GET.getlist("id")
    if group_ids:
        group_list = list(
            Group.objects.filter(
                project__in=projects,
                project__organization_id=organization_id,
                id__in=set(group_ids),
            ).exclude(status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS])
        )
    else:
        try:
            # bulk mutations are limited to 1000 items
            # TODO(dcramer): it'd be nice to support more than this, but its
            # a bit too complicated right now
            cursor_result, _ = search_fn({"limit": 1000, "paginator_options": {"max_limit": 1000}})
        except ValidationError as exc:
            return Response({"detail": six.text_type(exc)}, status=400)

        group_list = list(cursor_result)

    if not group_list:
        return Response(status=204)

    groups_by_project_id = defaultdict(list)
    for group in group_list:
        groups_by_project_id[group.project_id].append(group)

    for project in projects:
        _delete_groups(request, project, groups_by_project_id.get(project.id), delete_type="delete")

    return Response(status=204)


def self_subscribe_and_assign_issue(acting_user, group):
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
            return Actor(type=User, id=acting_user.id)


def track_update_groups(function):
    def wrapper(request, projects, *args, **kwargs):
        from sentry.utils import snuba

        try:
            response = function(request, projects, *args, **kwargs)
        except snuba.RateLimitExceeded:
            metrics.incr("group.update.http_response", sample_rate=1.0, tags={"status": 429})
            raise
        except Exception:
            metrics.incr("group.update.http_response", sample_rate=1.0, tags={"status": 500})
            # Continue raising the error now that we've incr the metric
            raise

        serializer = GroupValidator(
            data=request.data,
            partial=True,
            context={"project": projects[0], "access": getattr(request, "access", None)},
        )
        results = dict(serializer.validated_data) if serializer.is_valid() else {}
        tags = {key: True for key in results.keys()}
        tags["status"] = response.status_code

        metrics.incr("group.update.http_response", sample_rate=1.0, tags=tags)
        return response

    return wrapper


def rate_limit_endpoint(limit=1, window=1):
    def inner(function):
        def wrapper(*args, **kwargs):
            try:
                if ratelimiter.is_limited(
                    u"rate_limit_endpoint:{}".format(md5_text(function).hexdigest()),
                    limit=limit,
                    window=window,
                ):
                    return Response(
                        {
                            "detail": "You are attempting to use this endpoint too quickly. Limit is {}/{}s".format(
                                limit, window
                            )
                        },
                        status=429,
                    )
                else:
                    return function(*args, **kwargs)
            except Exception:
                raise

        return wrapper

    return inner


@track_update_groups
def update_groups(request, projects, organization_id, search_fn):
    group_ids = request.GET.getlist("id")
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

    # TODO(jess): We may want to look into refactoring GroupValidator
    # to support multiple projects, but this is pretty complicated
    # because of the assignee validation. Punting on this for now.
    for project in projects:
        serializer = GroupValidator(
            data=request.data,
            partial=True,
            context={"project": project, "access": getattr(request, "access", None)},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

    result = dict(serializer.validated_data)

    # so we won't have to requery for each group
    project_lookup = {p.id: p for p in projects}

    acting_user = request.user if request.user.is_authenticated() else None

    if not group_ids:
        try:
            # bulk mutations are limited to 1000 items
            # TODO(dcramer): it'd be nice to support more than this, but its
            # a bit too complicated right now
            cursor_result, _ = search_fn({"limit": 1000, "paginator_options": {"max_limit": 1000}})
        except ValidationError as exc:
            return Response({"detail": six.text_type(exc)}, status=400)

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

    if status in ("resolved", "resolvedInNextRelease"):
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
            activity_type = Activity.SET_RESOLVED_IN_RELEASE
            activity_data = {
                # no version yet
                "version": ""
            }
            status_details = {
                "inNextRelease": True,
                "actor": serialize(extract_lazy_object(request.user), request.user),
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
            activity_type = Activity.SET_RESOLVED_IN_RELEASE
            activity_data = {
                # no version yet
                "version": release.version
            }
            status_details = {
                "inRelease": release.version,
                "actor": serialize(extract_lazy_object(request.user), request.user),
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
            activity_type = Activity.SET_RESOLVED_IN_COMMIT
            activity_data = {"commit": commit.id}
            status_details = {
                "inCommit": serialize(commit, request.user),
                "actor": serialize(extract_lazy_object(request.user), request.user),
            }
            res_type_str = "in_commit"
        else:
            res_type_str = "now"
            activity_type = Activity.SET_RESOLVED
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
                if release:
                    resolution_params = {
                        "release": release,
                        "type": res_type,
                        "status": res_status,
                        "actor_id": request.user.id if request.user.is_authenticated() else None,
                    }
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
                    # TODO(dcramer): we need a solution for activity rollups
                    # before sending notifications on bulk changes
                    if not is_bulk:
                        activity.send_notification()

            issue_resolved.send_robust(
                organization_id=organization_id,
                user=acting_user or request.user,
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
        new_status = STATUS_CHOICES[result["status"]]

        with transaction.atomic():
            happened = queryset.exclude(status=new_status).update(status=new_status)

            GroupResolution.objects.filter(group__in=group_ids).delete()

            if new_status == GroupStatus.IGNORED:
                metrics.incr("group.ignored", skip_internal=True)

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
                                "actor_id": request.user.id
                                if request.user.is_authenticated()
                                else None,
                            },
                        )
                        result["statusDetails"] = {
                            "ignoreCount": ignore_count,
                            "ignoreUntil": ignore_until,
                            "ignoreUserCount": ignore_user_count,
                            "ignoreUserWindow": ignore_user_window,
                            "ignoreWindow": ignore_window,
                            "actor": serialize(extract_lazy_object(request.user), request.user),
                        }
                else:
                    GroupSnooze.objects.filter(group__in=group_ids).delete()
                    ignore_until = None
                    result["statusDetails"] = {}
            else:
                result["statusDetails"] = {}

        if group_list and happened:
            if new_status == GroupStatus.UNRESOLVED:
                activity_type = Activity.SET_UNRESOLVED
                activity_data = {}

                for group in group_list:
                    if group.status == GroupStatus.IGNORED:
                        issue_unignored.send_robust(
                            project=project,
                            user=acting_user,
                            group=group,
                            transition_type="manual",
                            sender=update_groups,
                        )
                    else:
                        issue_unresolved.send_robust(
                            project=project,
                            user=acting_user,
                            group=group,
                            transition_type="manual",
                            sender=update_groups,
                        )
            elif new_status == GroupStatus.IGNORED:
                activity_type = Activity.SET_IGNORED
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

    if "assignedTo" in result:
        assigned_actor = result["assignedTo"]
        if assigned_actor:
            for group in group_list:
                resolved_actor = assigned_actor.resolve()

                GroupAssignee.objects.assign(group, resolved_actor, acting_user)
            result["assignedTo"] = serialize(
                assigned_actor.resolve(), acting_user, ActorSerializer()
            )
        else:
            for group in group_list:
                GroupAssignee.objects.deassign(group, acting_user)

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
                    type=Activity.SET_PRIVATE,
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
                    type=Activity.SET_PUBLIC,
                    user=acting_user,
                )

    # XXX(dcramer): this feels a bit shady like it should be its own
    # endpoint
    if result.get("merge") and len(group_list) > 1:
        # don't allow merging cross project
        if len(projects) > 1:
            return Response({"detail": "Merging across multiple projects is not supported"})
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
            type=Activity.MERGE,
            user=acting_user,
            data={"issues": [{"id": c.id} for c in groups_to_merge]},
        )

        result["merge"] = {
            "parent": six.text_type(primary_group.id),
            "children": [six.text_type(g.id) for g in groups_to_merge],
        }

    # Support moving groups in or out of the inbox
    inbox = result.get("inbox", None)
    if inbox is not None:
        if inbox:
            for group in group_list:
                add_group_to_inbox(group, GroupInboxReason.MANUAL)
        elif not inbox:
            GroupInbox.objects.filter(group__in=group_ids).delete()
        result["inbox"] = inbox

    return Response(result)
