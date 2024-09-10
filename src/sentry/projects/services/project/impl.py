from __future__ import annotations

from django.db import router, transaction

from sentry.api.serializers import ProjectSerializer
from sentry.auth.services.auth import AuthenticationContext
from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc import OptionValue
from sentry.hybridcloud.rpc.filter_query import OpaqueSerializedResponse
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.team import Team, TeamStatus
from sentry.projects.services.project import (
    ProjectFilterArgs,
    ProjectService,
    RpcProject,
    RpcProjectFlags,
    RpcProjectOptionValue,
)
from sentry.projects.services.project.serial import serialize_project
from sentry.signals import project_created
from sentry.users.services.user import RpcUser


class DatabaseBackedProjectService(ProjectService):
    def get_by_id(self, *, organization_id: int, id: int) -> RpcProject | None:
        try:
            project: Project | None = Project.objects.get_from_cache(
                id=id, organization=organization_id
            )
        except ValueError:
            project = Project.objects.filter(id=id, organization=organization_id).first()
        except Project.DoesNotExist:
            return None
        if project:
            return serialize_project(project)
        return None

    def get_many_by_organizations(
        self,
        *,
        region_name: str,
        organization_ids: list[int],
    ) -> list[RpcProject]:
        projects = Project.objects.filter(
            organization__in=organization_ids,
            status=ObjectStatus.ACTIVE,
        ).order_by("-date_added")
        return [serialize_project(p) for p in projects]

    def get_option(self, *, project: RpcProject, key: str) -> RpcProjectOptionValue:
        from sentry import projectoptions

        orm_project = Project.objects.get_from_cache(id=project.id)
        result = ProjectOption.objects.get_all_values(orm_project)
        keyed_result = result.get(key)

        well_known_key = projectoptions.lookup_well_known_key(key)
        well_known_result = None if well_known_key is None else well_known_key.get_default(project)

        return RpcProjectOptionValue(keyed_result=keyed_result, well_known_result=well_known_result)

    def update_option(self, *, project: RpcProject, key: str, value: OptionValue) -> bool:
        orm_project = Project.objects.get(id=project.id)
        return ProjectOption.objects.set_value(orm_project, key, value)

    def delete_option(self, *, project: RpcProject, key: str) -> None:
        orm_project = Project.objects.get(id=project.id)
        ProjectOption.objects.unset_value(orm_project, key)

    def serialize_many(
        self,
        *,
        organization_id: int,
        filter: ProjectFilterArgs,
        as_user: RpcUser | None = None,
        auth_context: AuthenticationContext | None = None,
    ) -> list[OpaqueSerializedResponse]:
        from sentry.api.serializers import serialize

        if as_user is None and auth_context:
            as_user = auth_context.user

        return serialize(
            list(
                Project.objects.filter(
                    id__in=filter.get("project_ids", []), organization_id=organization_id
                )
            ),
            user=as_user,
            serializer=ProjectSerializer(),
        )

    def create_project_for_organization(
        self,
        *,
        organization_id: int,
        project_name: str,
        platform: str,
        user_id: int,
        add_org_default_team: bool | None = False,
    ) -> RpcProject:
        with transaction.atomic(router.db_for_write(Project)):
            project = Project.objects.create(
                name=project_name,
                organization_id=organization_id,
                platform=platform,
            )

            if add_org_default_team:
                team = (
                    Team.objects.filter(organization_id=organization_id, status=TeamStatus.ACTIVE)
                    .order_by("date_added")
                    .first()
                )

                # Makes a best effort to add the default org team,
                #  but doesn't block if one doesn't exist.
                if team:
                    project.add_team(team)

            project_created.send(
                project=project,
                default_rules=True,
                sender=self.create_project_for_organization,
                user_id=user_id,
            )

            return serialize_project(project)

    def get_or_create_project_for_organization(
        self,
        *,
        organization_id: int,
        project_name: str,
        platform: str,
        user_id: int,
        add_org_default_team: bool | None = False,
    ) -> RpcProject:
        project_query = Project.objects.filter(
            organization_id=organization_id,
            name=project_name,
            platform=platform,
            status=ObjectStatus.ACTIVE,
        ).order_by("date_added")

        if project_query.exists():
            return serialize_project(project_query[0])

        return self.create_project_for_organization(
            organization_id=organization_id,
            project_name=project_name,
            platform=platform,
            user_id=user_id,
            add_org_default_team=add_org_default_team,
        )

    def get_flags(self, *, organization_id: int, project_id: id) -> RpcProjectFlags:
        project = Project.objects.filter(
            organization_id=organization_id,
            id=project_id,
        ).get()
        return RpcProjectFlags(
            has_releases=bool(project.flags.has_releases),
            has_issue_alerts_targeting=bool(project.flags.has_issue_alerts_targeting),
            has_transactions=bool(project.flags.has_transactions),
            has_alert_filters=bool(project.flags.has_alert_filters),
            has_sessions=bool(project.flags.has_sessions),
            has_profiles=bool(project.flags.has_profiles),
            has_replays=bool(project.flags.has_replays),
            has_feedbacks=bool(project.flags.has_feedbacks),
            has_new_feedbacks=bool(project.flags.has_new_feedbacks),
            spike_protection_error_currently_active=bool(
                project.flags.spike_protection_error_currently_active
            ),
            spike_protection_transaction_currently_active=bool(
                project.flags.spike_protection_transaction_currently_active
            ),
            spike_protection_attachment_currently_active=bool(
                project.flags.spike_protection_attachment_currently_active
            ),
            has_minified_stack_trace=bool(project.flags.has_minified_stack_trace),
            has_cron_monitors=bool(project.flags.has_cron_monitors),
            has_cron_checkins=bool(project.flags.has_cron_checkins),
            has_sourcemaps=bool(project.flags.has_sourcemaps),
            has_custom_metrics=bool(project.flags.has_custom_metrics),
            has_high_priority_alerts=bool(project.flags.has_high_priority_alerts),
            has_insights_http=bool(project.flags.has_insights_http),
            has_insights_db=bool(project.flags.has_insights_db),
            has_insights_assets=bool(project.flags.has_insights_assets),
            has_insights_app_start=bool(project.flags.has_insights_app_start),
            has_insights_screen_load=bool(project.flags.has_insights_screen_load),
            has_insights_vitals=bool(project.flags.has_insights_vitals),
            has_insights_caches=bool(project.flags.has_insights_caches),
            has_insights_queues=bool(project.flags.has_insights_queues),
            has_insights_llm_monitoring=bool(project.flags.has_insights_llm_monitoring),
        )
