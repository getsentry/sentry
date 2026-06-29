from sentry.integrations.source_code_management.auto_link_repos import (
    auto_link_repos_on_project_create,
)
from sentry.signals import project_created

project_created.connect(
    auto_link_repos_on_project_create,
    weak=False,
    dispatch_uid="auto_link_repos_on_project_create",
)
