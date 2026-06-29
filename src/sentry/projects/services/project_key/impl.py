from django.db.models import F

from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey, UseCase
from sentry.projects.services.project_key import ProjectKeyRole, ProjectKeyService, RpcProjectKey
from sentry.projects.services.project_key.serial import serialize_project_key


class DatabaseBackedProjectKeyService(ProjectKeyService):
    def _get_project_key(self, project_id: int, role: ProjectKeyRole) -> RpcProjectKey | None:
        project_keys = ProjectKey.objects.filter(
            use_case=UseCase.USER.value,
            project=project_id,
            roles=F("roles").bitor(role.as_orm_role()),
        )

        if project_keys:
            return serialize_project_key(project_keys[0])

        return None

    def get_project_key(
        self, organization_id: int, project_id: int, role: ProjectKeyRole
    ) -> RpcProjectKey | None:
        return self._get_project_key(project_id=project_id, role=role)

    def get_default_project_key(
        self, *, organization_id: int, project_id: int
    ) -> RpcProjectKey | None:
        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            return None

        key = ProjectKey.get_default(project)
        return serialize_project_key(key) if key else None

    def get_project_key_by_cell(
        self, *, cell_name: str, project_id: int, role: ProjectKeyRole
    ) -> RpcProjectKey | None:
        return self._get_project_key(project_id=project_id, role=role)

    def create_project_key(
        self, *, organization_id: int, project_id: int, label: str | None = None
    ) -> RpcProjectKey | None:
        """Create a new ProjectKey under the given project. ``label`` is
        the display name shown in the Keys list UI; when None or empty,
        ProjectKey.save() auto-generates a random petname (see
        projectkey.py) rather than leaving the label blank. Returns the
        serialized key or None if the project doesn't exist under the
        given organization."""
        try:
            project = Project.objects.get(id=project_id, organization_id=organization_id)
        except Project.DoesNotExist:
            return None

        key = ProjectKey.objects.create(project=project, label=label)
        return serialize_project_key(key)

    def delete_project_key(self, *, organization_id: int, project_id: int, public_key: str) -> bool:
        # Scope by organization+project so a stolen or malformed key value
        # can't delete keys on an unrelated project.
        #
        # ProjectKey is a ReplicatedCellModel; a naive QuerySet.delete()
        # bypasses the per-instance override that emits the outbox for
        # cross-silo replica cleanup. Fetch the row first so the
        # model-level delete() runs and outboxes correctly.
        #
        # ``use_case=UseCase.USER`` matches the HTTP endpoint's
        # ``for_request`` filter (models/projectkey.py), which protects
        # internal keys (PROFILING, TEMPEST, DEMO) from deletion by
        # non-superusers. Stripe Projects only ever creates USER keys
        # via ``create_project_key``, so this filter is both correct
        # and hardening against a caller that supplies an unexpected
        # public_key value.
        try:
            key = ProjectKey.objects.get(
                project__organization_id=organization_id,
                project_id=project_id,
                public_key=public_key,
                use_case=UseCase.USER.value,
            )
        except ProjectKey.DoesNotExist:
            return False
        key.delete()
        return True
