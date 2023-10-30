from sentry.runner import configure

configure(skip_service_validation=True)

from sentry.conf.server import *  # noqa: F401, F403
