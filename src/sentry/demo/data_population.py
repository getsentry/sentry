from sentry.utils.samples import generate_user
from sentry.utils.samples import create_sample_event


def populate_python_project(project):
    create_sample_event(
        project=project,
        platform="python",
        user=generate_user(),
    )


def populate_react_project(project):
    create_sample_event(
        project=project,
        platform="javascript-react",
        user=generate_user(),
    )
