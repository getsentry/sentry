import logging
from collections.abc import Sequence

from django.core.exceptions import ValidationError
from django.db import IntegrityError, router, transaction
from django.db.models import F
from django.db.models.signals import post_save, pre_save

from sentry import analytics, features
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.integrations.analytics import IntegrationResolveCommitEvent, IntegrationResolvePREvent
from sentry.issues.action_log import (
    ActionSource,
    GroupActionActor,
    action_context_scope,
)
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphistory import (
    GroupHistoryStatus,
    record_group_history,
)
from sentry.models.grouplink import GroupLink
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.repository import Repository
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import buffer_incr_complete
from sentry.tasks.clear_expired_resolutions import clear_expired_resolutions
from sentry.types.activity import ActivityType
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.users.services.user_option import get_option_from_list, user_option_service

logger = logging.getLogger(__name__)


def validate_release_empty_version(instance: Release, **kwargs):
    if not Release.is_valid_version(instance.version):
        raise ValidationError(
            f"release_id({instance.id}) failed to save because of invalid version"
        )


def resolve_group_resolutions(instance, created, **kwargs):
    if not created:
        return

    transaction.on_commit(
        lambda: clear_expired_resolutions.delay(release_id=instance.id),
        router.db_for_write(Release),
    )


def remove_resolved_link(link):
    with transaction.atomic(router.db_for_write(GroupLink)):
        link.delete()


def remove_resolved_pull_request_link(link: GroupLink, pull_request: PullRequest) -> None:
    group_id = link.group_id
    with transaction.atomic(router.db_for_write(GroupLink)):
        link.delete()
        transaction.on_commit(
            lambda: _create_pull_request_activities(
                [group_id],
                pull_request_id=pull_request.id,
                activity_type=ActivityType.PULL_REQUEST_UNLINKED,
            ),
            router.db_for_write(GroupLink),
        )


def _find_pull_request_author_user(author: CommitAuthor, organization_id: int) -> RpcUser | None:
    if author.organization_id != organization_id:
        return None

    users = list(author.find_users())
    if users:
        return users[0]

    # Commit resolution generally has a real commit author email, so find_users()
    # can match an org member by verified email. PR webhooks can create authors
    # from a GitHub actor with a placeholder email, so use the same ExternalActor
    # fallback that serializes PR authors.
    # Keep this lazy; receivers are imported during process initialization.
    from sentry.api.serializers.models.release import get_author_users_by_external_actors

    external_actor_users, _ = get_author_users_by_external_actors(
        [author],
        organization_id,
    )
    user_id = external_actor_users.get(author)
    if user_id is None:
        return None

    user_id_int = int(user_id)
    if not OrganizationMember.objects.filter(
        organization_id=organization_id, user_id=user_id_int
    ).exists():
        return None

    return user_service.get_user(user_id=user_id_int)


def resolved_in_commit(instance: Commit, created, **kwargs):
    """
    Creates GroupLinks and referenced activity for commits that reference issues.

    Resolution happens when a release is created that includes these commits, via
    update_group_resolutions() in src/sentry/models/releases/set_commits.py. This
    prevents issues from being resolved prematurely when commits are pushed to
    feature branches.
    """
    groups = instance.find_referenced_groups()

    # Delete GroupLinks where message may have changed
    group_ids = {g.id for g in groups}
    group_links = GroupLink.objects.filter(
        linked_type=GroupLink.LinkedType.commit,
        relationship=GroupLink.Relationship.resolves,
        linked_id=instance.id,
    )
    for link in group_links:
        if link.group_id not in group_ids:
            remove_resolved_link(link)

    if len(groups) == 0:
        return

    try:
        repo = Repository.objects.get(id=instance.repository_id)
    except Repository.DoesNotExist:
        repo = None

    if instance.author:
        with in_test_hide_transaction_boundary():
            user_list = list(instance.author.find_users())
    else:
        user_list = []

    acting_user: RpcUser | None = None

    self_assign_issue = "0"
    if user_list:
        acting_user = user_list[0]
        with in_test_hide_transaction_boundary():
            self_assign_issue = get_option_from_list(
                user_option_service.get_many(
                    filter={"user_ids": [acting_user.id], "keys": ["self_assign_issue"]}
                ),
                key="self_assign_issue",
                default="0",
            )

    for group in groups:
        try:
            # XXX(dcramer): This code is somewhat duplicated from the
            # project_group_index mutation api
            with transaction.atomic(router.db_for_write(GroupLink)):
                GroupLink.objects.create(
                    group_id=group.id,
                    project_id=group.project_id,
                    linked_type=GroupLink.LinkedType.commit,
                    relationship=GroupLink.Relationship.resolves,
                    linked_id=instance.id,
                )

                if acting_user:
                    if self_assign_issue == "1" and not group.assignee_set.exists():
                        with action_context_scope(
                            source=ActionSource.SYSTEM, actor=GroupActionActor.user(acting_user.id)
                        ):
                            GroupAssignee.objects.assign(
                                group=group, assigned_to=acting_user, acting_user=acting_user
                            )

                    # while we only create activity and assignment for one user we want to
                    # subscribe every user
                    for user in user_list:
                        GroupSubscription.objects.subscribe(
                            subscriber=user,
                            group=group,
                            reason=GroupSubscriptionReason.status_change,
                        )

                activity_kwargs = {
                    "project_id": group.project_id,
                    "group": group,
                    "type": ActivityType.REFERENCED_IN_COMMIT.value,
                    "ident": instance.id,
                    "data": {"commit": instance.id},
                }
                if acting_user is not None:
                    activity_kwargs["user_id"] = acting_user.id

                Activity.objects.create(**activity_kwargs)

        except IntegrityError:
            pass
        else:
            if repo is not None and repo.integration_id is not None:
                analytics.record(
                    IntegrationResolveCommitEvent(
                        provider=repo.provider,
                        id=repo.integration_id,
                        organization_id=repo.organization_id,
                    )
                )


def resolved_in_pull_request(instance: PullRequest, created, **kwargs):
    groups = instance.find_referenced_groups()

    # Delete GroupLinks where message may have changed
    group_ids = {g.id for g in groups}
    group_links = GroupLink.objects.filter(
        linked_type=GroupLink.LinkedType.pull_request,
        relationship=GroupLink.Relationship.resolves,
        linked_id=instance.id,
    )
    for link in group_links:
        if link.group_id not in group_ids:
            remove_resolved_pull_request_link(link, instance)

    if len(groups) == 0:
        return

    try:
        repo = Repository.objects.get(id=instance.repository_id)
    except Repository.DoesNotExist:
        repo = None
    acting_user = (
        _find_pull_request_author_user(instance.author, instance.organization_id)
        if instance.author
        else None
    )

    for group in groups:
        try:
            with transaction.atomic(router.db_for_write(GroupLink)):
                GroupLink.objects.create(
                    group_id=group.id,
                    project_id=group.project_id,
                    linked_type=GroupLink.LinkedType.pull_request,
                    relationship=GroupLink.Relationship.resolves,
                    linked_id=instance.id,
                )
                if acting_user:
                    with action_context_scope(
                        source=ActionSource.SYSTEM, actor=GroupActionActor.user(acting_user.id)
                    ):
                        GroupAssignee.objects.assign(
                            group=group, assigned_to=acting_user, acting_user=acting_user
                        )

                Activity.objects.create(
                    project_id=group.project_id,
                    group=group,
                    type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
                    ident=instance.id,
                    user_id=acting_user.id if acting_user else None,
                    data={"pull_request": instance.id},
                )
                record_group_history(
                    group, GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST, actor=acting_user
                )
        except IntegrityError:
            pass
        else:
            if repo is not None and repo.integration_id is not None:
                analytics.record(
                    IntegrationResolvePREvent(
                        provider=repo.provider,
                        id=repo.integration_id,
                        organization_id=repo.organization_id,
                    )
                )


def _is_open_pull_request_state(state: str | None) -> bool:
    return state is None or state in (
        PullRequestLifecycleState.OPEN,
        PullRequestLifecycleState.LOCKED,
    )


def _groups_with_other_open_prs(group_ids: Sequence[int], *, pull_request_id: int) -> set[int]:
    """
    Return the subset of `group_ids` that still have at least one linked PR
    (other than `pull_request_id`) in an open state.

    A PR counts as open when its state is OPEN/LOCKED or NULL. NULL rows are
    legacy/unsynced PRs whose real state is unknown, so we conservatively count
    them as open.
    """
    sibling_links = list(
        GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.pull_request,
            group_id__in=group_ids,
        )
        .exclude(linked_id=pull_request_id)
        .values_list("group_id", "linked_id")
    )
    if not sibling_links:
        return set()

    sibling_pr_ids = {linked_id for _, linked_id in sibling_links}
    open_pr_ids = {
        pr_id
        for pr_id, state in PullRequest.objects.filter(id__in=sibling_pr_ids).values_list(
            "id", "state"
        )
        if _is_open_pull_request_state(state)
    }
    return {group_id for group_id, linked_id in sibling_links if linked_id in open_pr_ids}


def _create_pull_request_activities(
    group_ids: Sequence[int], *, pull_request_id: int, activity_type: ActivityType
) -> None:
    try:
        groups = list(
            Group.objects.filter(id__in=group_ids).select_related("project__organization")
        )
        # PULL_REQUEST_CLOSED predates the pr-lifecycle-activity flag and is always
        # emitted. The other lifecycle events are gated behind the flag.
        if activity_type != ActivityType.PULL_REQUEST_CLOSED:
            groups = [
                group
                for group in groups
                if features.has("organizations:pr-lifecycle-activity", group.project.organization)
            ]
        if not groups:
            return

        has_other_open_prs_by_group: set[int] | None = None
        if activity_type != ActivityType.PULL_REQUEST_REOPENED:
            has_other_open_prs_by_group = _groups_with_other_open_prs(
                [group.id for group in groups], pull_request_id=pull_request_id
            )

        for group in groups:
            data: dict[str, int | bool] = {"pull_request": pull_request_id}
            if has_other_open_prs_by_group is not None:
                data["has_other_open_prs"] = group.id in has_other_open_prs_by_group

            Activity.objects.create(
                project_id=group.project_id,
                group=group,
                type=activity_type.value,
                ident=str(pull_request_id),
                data=data,
            )
    except Exception:
        logger.exception(
            "Failed to create pull request lifecycle activity",
            extra={"activity_type": activity_type.name.lower()},
        )


def _get_pull_request_activity_type_from_state(
    state: str | None,
) -> ActivityType | None:
    if _is_open_pull_request_state(state):
        return ActivityType.PULL_REQUEST_REOPENED

    match state:
        case PullRequestLifecycleState.CLOSED | PullRequestLifecycleState.SUPERSEDED:
            return ActivityType.PULL_REQUEST_CLOSED
        case PullRequestLifecycleState.MERGED:
            return ActivityType.PULL_REQUEST_MERGED
        case _:
            return None


def pull_request_state_changing(instance: PullRequest, **kwargs: object) -> None:
    """Emit group activities when a linked PR moves between open and non-open states."""
    try:
        if instance.pk is None:
            return

        old_state = (
            PullRequest.objects.filter(pk=instance.pk).values_list("state", flat=True).first()
        )
        previous_is_open = _is_open_pull_request_state(old_state)
        is_open = _is_open_pull_request_state(instance.state)
        if previous_is_open == is_open:
            return

        activity_type = _get_pull_request_activity_type_from_state(instance.state)
        if activity_type is None:
            return

        group_ids: list[int] = list(
            GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.pull_request,
                linked_id=instance.id,
            ).values_list("group_id", flat=True)
        )
        if not group_ids:
            return

        transaction.on_commit(
            lambda: _create_pull_request_activities(
                group_ids,
                pull_request_id=instance.id,
                activity_type=activity_type,
            ),
            router.db_for_write(PullRequest),
        )
    except Exception:
        # If something fails we don't want to block the model from saving.
        logger.exception("Failed to create pull request lifecycle activity")


pre_save.connect(
    validate_release_empty_version,
    sender=Release,
    dispatch_uid="validate_release_empty_version",
    weak=False,
)

post_save.connect(
    resolve_group_resolutions, sender=Release, dispatch_uid="resolve_group_resolutions", weak=False
)

post_save.connect(resolved_in_commit, sender=Commit, dispatch_uid="resolved_in_commit", weak=False)


pre_save.connect(
    pull_request_state_changing,
    sender=PullRequest,
    dispatch_uid="pull_request_state_changing",
    weak=False,
)

post_save.connect(
    resolved_in_pull_request,
    sender=PullRequest,
    dispatch_uid="resolved_in_pull_request",
    weak=False,
)


@buffer_incr_complete.connect(
    sender=ReleaseProject, dispatch_uid="project_has_releases_receiver", weak=False
)
def project_has_releases_receiver(filters, **_):
    try:
        project = ReleaseProject.objects.select_related("project").get(**filters).project
    except ReleaseProject.DoesNotExist:
        return

    if not project.flags.has_releases:
        project.flags.has_releases = True
        project.update(flags=F("flags").bitor(Project.flags.has_releases))
