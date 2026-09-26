from django.utils.encoding import force_str

from sentry import options
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project


def build_email_subject_prefix(project: Project) -> str:
    prefix = ProjectOption.objects.get_value(project, "mail:subject_prefix") or options.get(
        "mail.subject-prefix"
    )
    return f"{force_str(prefix).rstrip()} "
