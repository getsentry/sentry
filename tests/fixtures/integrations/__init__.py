import os

FIXTURE_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)))

from .mock_service import MockService  # noqa
from .stub_service import StubService  # noqa
