from typing import Iterable, List, Optional

from sentry.models.options.user_option import UserOption
from sentry.models.project import Project
from sentry.services.hybrid_cloud.user_option import UserOptionService


class DatabaseBackedUserOptionService(UserOptionService):
    def get(
        self,
        user_ids: Iterable[int],
        key: str,
        project: Optional["Project"],
    ) -> List["UserOption"]:
        queryset = UserOption.objects.filter(user_id__in=user_ids, key=key)  # type: ignore
        if project is not None:
            queryset = queryset.filter(project=project)
        return list(queryset)

    def close(self) -> None:
        pass
