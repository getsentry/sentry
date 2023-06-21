from typing import TypedDict

# Do not import _anything_ by sentry from here, or mypy/django-stubs will break
# typing for django settings globally.


class TopicDefinition(TypedDict):
    cluster: str
