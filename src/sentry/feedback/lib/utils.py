from __future__ import annotations

from enum import Enum

from sentry import options

UNREAL_FEEDBACK_UNATTENDED_MESSAGE = "Sent in the unattended mode"


class FeedbackCreationSource(Enum):
    NEW_FEEDBACK_ENVELOPE = "new_feedback_envelope"
    USER_REPORT_DJANGO_ENDPOINT = "user_report_sentry_django_endpoint"
    USER_REPORT_ENVELOPE = "user_report_envelope"
    CRASH_REPORT_EMBED_FORM = "crash_report_embed_form"
    UPDATE_USER_REPORTS_TASK = "update_user_reports_task"

    @classmethod
    def new_feedback_category_values(cls) -> set[str]:
        return {
            c.value
            for c in [
                cls.NEW_FEEDBACK_ENVELOPE,
            ]
        }

    @classmethod
    def old_feedback_category_values(cls) -> set[str]:
        return {
            c.value
            for c in [
                cls.CRASH_REPORT_EMBED_FORM,
                cls.USER_REPORT_ENVELOPE,
                cls.USER_REPORT_DJANGO_ENDPOINT,
                cls.UPDATE_USER_REPORTS_TASK,
            ]
        }


def is_in_feedback_denylist(organization):
    return organization.slug in options.get("feedback.organizations.slug-denylist")
