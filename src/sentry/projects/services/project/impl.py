from __future__ import annotations

from django.db import router, transaction

from sentry.api.helpers.default_symbol_sources import set_default_symbol_sources
from sentry.api.serializers import ProjectSerializer
from sentry.auth.services.auth import AuthenticationContext
from sentry.constants import ObjectStatus
from sentry.db.models.query import update
from sentry.hybridcloud.rpc import OptionValue
from sentry.hybridcloud.rpc.filter_query import OpaqueSerializedResponse
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.team import Team, TeamStatus
from sentry.projects.services.project import (
    ProjectFilterArgs,
    ProjectService,
    RpcProject,
    RpcProjectOptionValue,
)
from sentry.projects.services.project.model import ProjectUpdates
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

    def get_by_slug(self, *, organization_id: int, slug: str) -> RpcProject | None:
        project: Project | None = Project.objects.filter(
            slug=slug, organization=organization_id
        ).first()
        if project:
            return serialize_project(project)
        return None

    def get_by_external_id(self, *, organization_id: int, external_id: str) -> RpcProject | None:
        project: Project | None = Project.objects.filter(
            organization=organization_id,
            external_id=external_id,
        ).first()
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
        external_id: str | None = None,
    ) -> RpcProject:
        with transaction.atomic(router.db_for_write(Project)):
            project = Project.objects.create(
                name=project_name,
                organization_id=organization_id,
                platform=platform,
                external_id=external_id,
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

            set_default_symbol_sources(project)

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
        external_id: str | None = None,
    ) -> RpcProject:
        project_query = Project.objects.filter(
            organization_id=organization_id,
            name=project_name,
            platform=platform,
            external_id=external_id,
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
            external_id=external_id,
        )

    def update_project(
        self,
        *,
        organization_id: int,
        project_id: int,
        updates: ProjectUpdates,
    ) -> RpcProject:
        project: Project = Project.objects.get(
            id=project_id,
            organization_id=organization_id,
        )
        update(project, **updates)
        return serialize_project(project)
