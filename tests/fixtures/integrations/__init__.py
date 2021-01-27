
import os

FIXTURE_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)))

from .stub_service import StubService
from .mock_service import MockService
