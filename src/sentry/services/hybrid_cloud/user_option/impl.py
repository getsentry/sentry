from typing import Iterable, List, Optional

from sentry.models import Organization
from sentry.models.options.user_option import UserOption
from sentry.models.project import Project
from sentry.services.hybrid_cloud.user_option import ApiUserOption, UserOptionService


class DatabaseBackedUserOptionService(UserOptionService):
    def delete_options(self, *, options: List[ApiUserOption]) -> None:
        UserOption.objects.filter(id__in=[o.id for o in options]).delete()  # type: ignore

    def _serialize_user_option(self, op: UserOption) -> ApiUserOption:
        return ApiUserOption(
            id=op.id,
            user_id=op.user_id,
            value=op.value,
            key=op.key,
            project_id=op.project_id,
            organization_id=op.organization_id,
        )

    def get_many(
        self,
        *,
        user_ids: Iterable[int],
        keys: Iterable[str],
        project: Optional[Project] = None,
        organization: Optional[Organization] = None,
    ) -> List[ApiUserOption]:
        queryset = UserOption.objects.filter(user_id__in=user_ids, key_in=keys)  # type: ignore
        if project is not None:
            queryset = queryset.filter(project=project)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return [self._serialize_user_option(op) for op in queryset]

    def close(self) -> None:
        pass
