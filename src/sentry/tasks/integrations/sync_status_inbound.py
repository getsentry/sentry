from collections.abc import Mapping
from typing import Any

from django.utils import timezone as django_timezone

from sentry import analytics
from sentry.api.helpers.group_index.update import get_current_release_version_of_group
from sentry.models.group import Group, GroupStatus
from sentry.models.groupresolution import GroupResolution
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.models.release import Release, ReleaseStatus, follows_semver_versioning_scheme
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


@instrumented_task(
    name="sentry.tasks.integrations.sync_status_inbound",
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

    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        raise Integration.DoesNotExist

    organizations = Organization.objects.filter(id=organization_id)
    affected_groups = Group.objects.get_groups_by_external_issue(
        integration, organizations, issue_key
    )
    if not affected_groups:
        return

    installation = integration.get_installation(organization_id=organization_id)
    config = installation.get_config_data()

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
        activity_type = ActivityType.SET_RESOLVED
        # If the resolution strategy is set to resolve in the next release or current release
        if config.get("resolution_strategy") in [
            "resolve_next_release",
            "resolve_current_release",
        ]:
            # only allow setting resolved in release if there is a release for each project
            all_project_ids = list({group.project_id for group in affected_groups})
            has_releases_for_each_project = all(
                Release.objects.filter(
                    projects=project_id, organization_id=organization_id, status=ReleaseStatus.OPEN
                ).exists()
                for project_id in all_project_ids
            )
            if has_releases_for_each_project:
                if config.get("resolution_strategy") == "resolve_next_release":
                    activity_type = ActivityType.SET_RESOLVED_IN_RELEASE
                    activity_data["inNextRelease"] = True
                elif config.get("resolution_strategy") == "resolve_current_release":
                    activity_type = ActivityType.SET_RESOLVED_IN_RELEASE

        Group.objects.update_group_status(
            groups=affected_groups,
            status=GroupStatus.RESOLVED,
            substatus=None,
            activity_type=activity_type,
            activity_data=activity_data,
        )
        for group in affected_groups:
            # update the resolutions
            # probably should be done within a single transaction with the status but this is fine for now
            # note this logic is ported from src/sentry/api/helpers/group_index/update.py
            if activity_type == ActivityType.SET_RESOLVED_IN_RELEASE:
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
                    release_version=last_release_by_date.version,
                )

                resolution_params = {
                    "status": GroupStatus.RESOLVED,
                    "release": last_release_by_date,  # Is this the right release?
                }
                if config.get("resolution_strategy") == "resolve_next_release":
                    # get the current release version of the group if we are resolving in the next release
                    current_release_version = get_current_release_version_of_group(
                        group=group, follows_semver=follows_semver
                    )
                    resolution_params["current_release_version"] = current_release_version
                    resolution_params["type"] = GroupResolution.Type.in_next_release
                else:
                    resolution_params["type"] = GroupResolution.Type.in_release

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
