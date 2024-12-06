import logging
from collections.abc import Iterable, Mapping
from typing import Any

from django.db.models import Q
from django.utils import timezone as django_timezone

from sentry import analytics
from sentry.api.helpers.group_index.update import get_current_release_version_of_group
from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.models.group import Group, GroupStatus
from sentry.models.groupresolution import GroupResolution
from sentry.models.organization import Organization
from sentry.models.release import Release, ReleaseStatus, follows_semver_versioning_scheme
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus

logger = logging.getLogger(__name__)


def get_resolutions_and_activity_data_for_groups(
    affected_groups: Iterable[Group],
    resolution_strategy: str | None,
    activity_data: dict,
    organization_id: int,
):
    activity_data = activity_data.copy()
    resolutions_by_group_id = {}
    activity_type = ActivityType.SET_RESOLVED
    # If the resolution strategy is set to resolve in the next release or current release
    if resolution_strategy in [
        "resolve_next_release",
        "resolve_current_release",
    ]:
        all_project_ids = list({group.project_id for group in affected_groups})
        has_releases_for_each_project = all(
            Release.objects.filter(
                projects=project_id, organization_id=organization_id, status=ReleaseStatus.OPEN
            ).exists()
            for project_id in all_project_ids
        )
        logging_params = {
            "has_releases_for_each_project": has_releases_for_each_project,
            "resolution_strategy": resolution_strategy,
            "organization_id": organization_id,
        }
        logger.info(
            "get_resolutions_and_activity_data_for_groups.has_releases_for_each_project",
            extra=logging_params,
        )
        if has_releases_for_each_project:
            # found a release, we can proceed with non-dfeault resolutions
            if resolution_strategy == "resolve_next_release":
                activity_type = ActivityType.SET_RESOLVED_IN_RELEASE
                activity_data["inNextRelease"] = True
            elif resolution_strategy == "resolve_current_release":
                activity_type = ActivityType.SET_RESOLVED_IN_RELEASE

            for group in affected_groups:
                local_logging_params = logging_params.copy()
                # update the resolutions
                # probably should be done within a single transaction with the status but this is fine for now
                # note this logic is ported from src/sentry/api/helpers/group_index/update.py
                # find the latest release by date for the project
                last_release_by_date = (
                    Release.objects.filter(
                        projects=group.project,
                        organization_id=organization_id,
                        status=ReleaseStatus.OPEN,
                    )
                    .extra(select={"sort": "COALESCE(date_released, date_added)"})
                    .order_by("-sort")
                    .first()
                )
                # Check if semver versioning scheme is followed
                follows_semver = follows_semver_versioning_scheme(
                    org_id=organization_id,
                    project_id=group.project.id,
                    release_version=last_release_by_date.version if last_release_by_date else None,
                )

                local_logging_params.update(
                    {
                        "group_id": group.id,
                        "last_release_by_date": (
                            last_release_by_date.version if last_release_by_date else None
                        ),
                        "follows_semver": follows_semver,
                    }
                )
                logger.info(
                    "get_resolutions_and_activity_data_for_groups.last_release_by_date",
                    extra=local_logging_params,
                )

                resolution_params = {
                    "status": GroupStatus.RESOLVED,
                    "release": last_release_by_date,  # Is this the right release?
                    "type": (
                        GroupResolution.Type.in_next_release
                        if resolution_strategy == "resolve_next_release"
                        else GroupResolution.Type.in_release
                    ),
                }

                if resolution_strategy == "resolve_next_release":
                    # get the current release version of the group if we are resolving in the next release
                    current_release_version = get_current_release_version_of_group(
                        group=group, follows_semver=follows_semver
                    )

                    resolution_params["current_release_version"] = current_release_version
                    # if semver, set current_release_version in activity_data
                    if follows_semver:
                        activity_data.update({"current_release_version": current_release_version})
                    else:
                        try:
                            current_release_obj = Release.objects.get(
                                version=current_release_version,
                                organization_id=organization_id,
                            )

                            # If we already know the `next` release in date based ordering
                            # when clicking on `resolvedInNextRelease` because it is already
                            # been released, there is no point in setting GroupResolution to
                            # be of type in_next_release but rather in_release would suffice

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
                                    organization_id=organization_id,
                                )
                                .extra(select={"sort": "COALESCE(date_released, date_added)"})
                                .order_by("sort", "id")[:1]
                                .get()
                            )
                            resolution_params.update({"release": resolved_in_release})
                            activity_data.update({"version": resolved_in_release.version})
                            local_logging_params.update(
                                {"resolved_in_release": resolved_in_release.version}
                            )
                            logger.info(
                                "get_resolutions_and_activity_data_for_groups.resolved_in_release",
                                extra=local_logging_params,
                            )
                        except Release.DoesNotExist:
                            # If it gets here, it means we don't know the upcoming
                            # release yet because it does not exist, and so we should
                            # fall back to our current model
                            logger.info(
                                "get_resolutions_and_activity_data_for_groups.next_release_not_found",
                                extra=local_logging_params,
                            )

                resolutions_by_group_id[group.id] = resolution_params

    return resolutions_by_group_id, activity_type, activity_data


@instrumented_task(
    name="sentry.integrations.tasks.sync_status_inbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(Integration.DoesNotExist,))
@track_group_async_operation
def sync_status_inbound(
    integration_id: int, organization_id: int, issue_key: str, data: Mapping[str, Any]
) -> None:
    from sentry.integrations.mixins import ResolveSyncAction

    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )
    if integration is None:
        raise Integration.DoesNotExist

    organizations = Organization.objects.filter(id=organization_id)
    affected_groups = Group.objects.get_groups_by_external_issue(
        integration, organizations, issue_key
    )
    if not affected_groups:
        return

    installation = integration.get_installation(organization_id=organization_id)
    if not (hasattr(installation, "get_resolve_sync_action") and installation.org_integration):
        return

    config = installation.org_integration.config
    try:
        # This makes an API call.
        action = installation.get_resolve_sync_action(data)
    except Exception:
        return

    provider = installation.model.get_provider()
    activity_data = {
        "provider": provider.name,
        "provider_key": provider.key,
        "integration_id": integration_id,
    }
    if action == ResolveSyncAction.RESOLVE:
        (
            resolutions_by_group_id,
            activity_type,
            activity_data,
        ) = get_resolutions_and_activity_data_for_groups(
            affected_groups, config.get("resolution_strategy"), activity_data, organization_id
        )
        Group.objects.update_group_status(
            groups=affected_groups,
            status=GroupStatus.RESOLVED,
            substatus=None,
            activity_type=activity_type,
            activity_data=activity_data,
        )
        # after we update the group, pdate the resolutions
        for group in affected_groups:
            resolution_params = resolutions_by_group_id.get(group.id)
            if resolution_params:
                resolution, created = GroupResolution.objects.get_or_create(
                    group=group, defaults=resolution_params
                )
                if not created:
                    resolution.update(datetime=django_timezone.now(), **resolution_params)
            analytics.record(
                "issue.resolved",
                project_id=group.project.id,
                default_user_id=organizations[0].get_default_owner().id,
                organization_id=organization_id,
                group_id=group.id,
                resolution_type="with_third_party_app",
                provider=provider.key,
                issue_type=group.issue_type.slug,
                issue_category=group.issue_category.name.lower(),
            )
    elif action == ResolveSyncAction.UNRESOLVE:
        Group.objects.update_group_status(
            groups=affected_groups,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ONGOING,
            activity_type=ActivityType.SET_UNRESOLVED,
            activity_data=activity_data,
        )
