from threading import local


class State(local):
    request = None
    data = {}


env = State()

from sentry.utils.sdk import RavenShim

raven = client = RavenShim()
