from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Optional, Tuple, Union

from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Project, Team, User


class BaseNotification:
    fine_tuning_key: Optional[str] = None
    is_message_issue_unfurl = False

    def __init__(self, project: "Project") -> None:
        self.project = project
        self.organization = self.project.organization

    def get_filename(self) -> str:
        raise NotImplementedError

    def get_category(self) -> str:
        raise NotImplementedError

    def get_subject(self, context: Optional[Mapping[str, Any]] = None) -> str:
        """The subject line when sending this notifications as an email."""
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

    def get_recipient_context(
        self, recipient: Union["Team", "User"], extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        # Basically a noop.
        return {**extra_context}

    def get_notification_title(self) -> str:
        raise NotImplementedError

    def get_message_description(self) -> Any:
        context = getattr(self, "context", None)
        return context["text_description"] if context else None

    def get_type(self) -> str:
        raise NotImplementedError

    def get_unsubscribe_key(self) -> Optional[Tuple[str, int, Optional[str]]]:
        return None
