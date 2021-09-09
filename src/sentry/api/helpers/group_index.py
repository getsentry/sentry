import logging
from collections import defaultdict
from datetime import timedelta
from uuid import uuid4

import sentry_sdk
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import analytics, eventstream, features, search
from sentry.api.base import audit_logger
from sentry.api.fields import ActorField
from sentry.api.issue_search import convert_query_values, parse_search_query
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.app import ratelimiter
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.db.models.query import create_or_update
from sentry.exceptions import InvalidSearchQuery
from sentry.models import (
    TOMBSTONE_FIELDS_FROM_GROUP,
    Activity,
    ActorTuple,
    Commit,
    Environment,
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
    Release,
    Repository,
    Team,
    User,
    UserOption,
    follows_semver_versioning_scheme,
    remove_group_from_inbox,
)
from sentry.models.group import STATUS_UPDATE_CHOICES, looks_like_short_id
from sentry.models.groupinbox import GroupInbox, GroupInboxRemoveAction, add_group_to_inbox
from sentry.notifications.types import SUBSCRIPTION_REASON_MAP, GroupSubscriptionReason
from sentry.signals import (
    advanced_search_feature_gated,
    issue_deleted,
    issue_ignored,
    issue_mark_reviewed,
    issue_resolved,
    issue_unignored,
    issue_unresolved,
)
from sentry.tasks.deletion import delete_groups as delete_groups_task
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.tasks.merge import merge_groups
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry
from sentry.utils.compat import zip
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.functional import extract_lazy_object
from sentry.utils.hashlib import md5_text

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
    sentry_sdk.set_tag("search.query", query)
    sentry_sdk.set_tag("search.sort", query)
    if projects:
        sentry_sdk.set_tag("search.projects", len(projects) if len(projects) <= 5 else ">5")
    if environments:
        sentry_sdk.set_tag(
            "search.environments", len(environments) if len(environments) <= 5 else ">5"
        )
    if query:
        try:
            search_filters = convert_query_values(
                parse_search_query(query), projects, request.user, environments
            )
        except InvalidSearchQuery as e:
            raise ValidationError(f"Error parsing search query: {e}")

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
                    f"You need access to the advanced search feature to use {feature_name}"
                )


def get_by_short_id(organization_id, is_short_id_lookup, query):
    if is_short_id_lookup == "1" and looks_like_short_id(query):
        try:
            return Group.objects.by_qualified_short_id(organization_id, query)
        except Group.DoesNotExist:
            pass


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
        attrs = super().validate(attrs)
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
    status = serializers.ChoiceField(
        choices=zip(STATUS_UPDATE_CHOICES.keys(), STATUS_UPDATE_CHOICES.keys())
    )
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
        attrs = super().validate(attrs)
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
    # We remove `GroupInbox` rows here so that they don't end up influencing queries for
    # `Group` instances that are pending deletion
    GroupInbox.objects.filter(project_id=project.id, group__id__in=group_ids).delete()

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
            return Response({"detail": str(exc)}, status=400)

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
            return ActorTuple(type=User, id=acting_user.id)


def track_slo_response(name):
    def inner_func(function):
        def wrapper(request, *args, **kwargs):
            from sentry.utils import snuba

            try:
                response = function(request, *args, **kwargs)
            except snuba.RateLimitExceeded:
                metrics.incr(
                    f"{name}.slo.http_response",
                    sample_rate=1.0,
                    tags={
                        "status": 429,
                        "detail": "snuba.RateLimitExceeded",
                        "func": function.__qualname__,
                    },
                )
                raise
            except Exception:
                metrics.incr(
                    f"{name}.slo.http_response",
                    sample_rate=1.0,
                    tags={"status": 500, "detail": "Exception"},
                )
                # Continue raising the error now that we've incr the metric
                raise

            metrics.incr(
                f"{name}.slo.http_response",
                sample_rate=1.0,
                tags={"status": response.status_code, "detail": "response"},
            )
            return response

        return wrapper

    return inner_func


def build_rate_limit_key(function, request):
    ip = request.META["REMOTE_ADDR"]
    return f"rate_limit_endpoint:{md5_text(function.__qualname__).hexdigest()}:{ip}"


def rate_limit_endpoint(limit=1, window=1):
    def inner(function):
        def wrapper(self, request, *args, **kwargs):
            if ratelimiter.is_limited(
                build_rate_limit_key(function, request),
                limit=limit,
                window=window,
            ):
                return Response(
                    {
                        "detail": f"You are attempting to use this endpoint too quickly. Limit is {limit}/{window}s"
                    },
                    status=429,
                )
            else:
                return function(self, request, *args, **kwargs)

        return wrapper

    return inner


def get_current_release_version_of_group(group, follows_semver=False):
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
            ...
    else:
        # This sets current_release_version to the most recent release associated with a group
        # In order to be able to do that, `use_cache` has to be set to False. Otherwise,
        # group.get_last_release might not return the actual latest release associated with a
        # group but rather a cached version (which might or might not be the actual latest. It is
        # the first latest observed by Sentry)
        current_release_version = group.get_last_release(use_cache=False)
    return current_release_version


def update_groups(request, group_ids, projects, organization_id, search_fn):
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

    acting_user = request.user if request.user.is_authenticated else None

    if not group_ids:
        try:
            # bulk mutations are limited to 1000 items
            # TODO(dcramer): it'd be nice to support more than this, but its
            # a bit too complicated right now
            cursor_result, _ = search_fn({"limit": 1000, "paginator_options": {"max_limit": 1000}})
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
                        "actor_id": request.user.id if request.user.is_authenticated else None,
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
        new_status = STATUS_UPDATE_CHOICES[result["status"]]

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
                                "actor_id": request.user.id
                                if request.user.is_authenticated
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

    # XXX (ahmed): hack to get the activities to work properly on issues page. Not sure of
    # what performance impact this might have & this possibly should be moved else where
    try:
        if len(group_list) == 1:
            if res_type in (
                GroupResolution.Type.in_next_release,
                GroupResolution.Type.in_release,
            ):
                result["activity"] = serialize(
                    Activity.get_activities_for_group(group=group_list[0], num=100), acting_user
                )
    except UnboundLocalError:
        pass

    if "assignedTo" in result:
        assigned_actor = result["assignedTo"]
        assigned_by = (
            request.data.get("assignedBy")
            if request.data.get("assignedBy") in ["assignee_selector", "suggested_assignee"]
            else None
        )
        if assigned_actor:
            for group in group_list:
                resolved_actor = assigned_actor.resolve()

                assignment = GroupAssignee.objects.assign(group, resolved_actor, acting_user)
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
                    project=project,
                    user=acting_user,
                    group=group,
                    sender=update_groups,
                )
        result["inbox"] = inbox

    return Response(result)


def calculate_stats_period(stats_period, start, end):
    if stats_period is None:
        # default
        stats_period = "24h"
    elif stats_period == "":
        # disable stats
        stats_period = None

    if stats_period == "auto":
        stats_period_start = start
        stats_period_end = end
    else:
        stats_period_start = None
        stats_period_end = None
    return stats_period, stats_period_start, stats_period_end


def prep_search(cls, request, project, extra_query_kwargs=None):
    try:
        environment = cls._get_environment_from_request(request, project.organization_id)
    except Environment.DoesNotExist:
        # XXX: The 1000 magic number for `max_hits` is an abstraction leak
        # from `sentry.api.paginator.BasePaginator.get_result`.
        result = CursorResult([], None, None, hits=0, max_hits=1000)
        query_kwargs = {}
    else:
        environments = [environment] if environment is not None else environment
        query_kwargs = build_query_params_from_request(
            request, project.organization, [project], environments
        )
        if extra_query_kwargs is not None:
            assert "environment" not in extra_query_kwargs
            query_kwargs.update(extra_query_kwargs)

        query_kwargs["environments"] = environments
        result = search.query(**query_kwargs)
    return result, query_kwargs


def get_first_last_release(request, group):
    first_release = group.get_first_release()
    if first_release is not None:
        last_release = group.get_last_release()
    else:
        last_release = None

    if first_release is not None and last_release is not None:
        first_release, last_release = get_first_last_release_info(
            request, group, [first_release, last_release]
        )
    elif first_release is not None:
        first_release = get_release_info(request, group, first_release)
    elif last_release is not None:
        last_release = get_release_info(request, group, last_release)

    return first_release, last_release


def get_release_info(request, group, version):
    try:
        release = Release.objects.get(
            projects=group.project,
            organization_id=group.project.organization_id,
            version=version,
        )
    except Release.DoesNotExist:
        release = {"version": version}
    return serialize(release, request.user)


def get_first_last_release_info(request, group, versions):
    releases = {
        release.version: release
        for release in Release.objects.filter(
            projects=group.project,
            organization_id=group.project.organization_id,
            version__in=versions,
        )
    }
    serialized_releases = serialize(
        [releases.get(version) for version in versions],
        request.user,
    )
    # Default to a dictionary if the release object wasn't found and not serialized
    return [
        item if item is not None else {"version": version}
        for item, version in zip(serialized_releases, versions)
    ]
