from typing import Any, Mapping, MutableMapping, Optional, Set

from sentry.models import Group, Project, User
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri


class BaseNotification:
    def __init__(self, project: Project, group: Group) -> None:
        self.project = project
        self.organization = self.project.organization
        self.group = group

    def get_filename(self) -> str:
        raise NotImplementedError

    def get_category(self) -> str:
        raise NotImplementedError

    def get_title(self) -> str:
        raise NotImplementedError

    def get_participants(self) -> Mapping[ExternalProviders, Set[int]]:
        raise NotImplementedError

    def get_subject(self) -> str:
        raise NotImplementedError

    def get_reference(self) -> Any:
        raise NotImplementedError

    def get_reply_reference(self) -> Optional[Any]:
        return None

    def should_email(self) -> bool:
        return True

    def get_template(self) -> str:
        return f"sentry/emails/{self.get_filename()}.txt"

    def get_html_template(self) -> str:
        return f"sentry/emails/{self.get_filename()}.html"

    def get_project_link(self) -> str:
        return str(absolute_uri(f"/{self.organization.slug}/{self.project.slug}/"))

    def get_user_context(
        self, user: User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        return {}
