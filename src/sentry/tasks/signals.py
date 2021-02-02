from sentry.plugins.base import plugins
from sentry.tasks.base import instrumented_task
from sentry.utils.safe import safe_execute


@instrumented_task(name="sentry.tasks.signal")
def signal(name, payload, project_id=None, **kwargs):
    from sentry.mail import mail_adapter
    from sentry.models import Project

    if project_id is not None:
        project = Project.objects.get_from_cache(id=project_id)
    else:
        project = None

    for plugin in plugins.for_project(project, version=1):
        safe_execute(plugin.handle_signal, name=name, payload=payload, project=project)

    for plugin in plugins.for_project(project, version=2):
        safe_execute(plugin.handle_signal, name=name, payload=payload, project=project)

    if project:
        safe_execute(mail_adapter.handle_signal, name=name, payload=payload, project=project)
