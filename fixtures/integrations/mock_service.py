from __future__ import annotations

import os
import shutil
from collections import defaultdict
from typing import Any

from fixtures.integrations import FIXTURE_DIRECTORY
from fixtures.integrations.stub_service import StubService
from sentry.utils import json
from sentry.utils.numbers import base32_encode


class MockService(StubService):
    """
    A mock is a service that replicates the functionality of a real software
    system by implementing the same interface with simplified business logic.
    For example, a mocked random dice_roll function might return `hash(time()) % 6`.
    Like stubs, mocks can make tests simpler and more reliable.
    """

    def __init__(self, mode="memory"):
        """
        Initialize the mock instance. Wipe the previous instance's data if it exists.
        """
        super().__init__()
        self.mode = mode
        self._next_error_code = None
        self._next_ids = defaultdict(lambda: 0)

        if self.mode == "file":
            path = os.path.join(FIXTURE_DIRECTORY, self.service_name, "data")
            if os.path.exists(path):
                shutil.rmtree(path)
            os.makedirs(path)
        else:
            self._memory: dict[str, dict[str, Any]] = defaultdict(dict)

    def add_project(self, project):
        """
        Create a new, empty project.

        :param project: String name of project
        :return: void
        """
        self._next_ids.get(project)  # touch
        if self.mode == "file":
            self._get_project_path(project)

    def remove_project(self, project):
        """
        Totally wipe out a project.

        :param project: String name of project
        :return: void
        """
        del self._next_ids[project]
        if self.mode == "file":
            path = self._get_project_path(project)
            shutil.rmtree(path)

    def break_next_api_call(self, error_code=500):
        """
        Simulate an outage for a single API call.
        """
        self._next_error_code = error_code

    def _throw_if_broken(self, message_option=None):
        """
        See break_next_api_call.
        :param message_option: What should the message be if this raises?
        :raises: Generic Exception
        """
        if self._next_error_code:
            self._next_error_code = None
            message = message_option or f"{self.service_name} is down"
            raise Exception(f"{self._next_error_code}: {message}")

    def _get_project_names(self):
        return self._next_ids.keys()

    def _get_new_ticket_name(self, project):
        counter = self._next_ids[project]
        self._next_ids[project] = counter + 1

        return f"{project}-{base32_encode(counter)}"

    def _get_project_path(self, project):
        path = os.path.join(FIXTURE_DIRECTORY, self.service_name, "data", project)

        if not os.path.exists(path):
            os.makedirs(path)
        return path

    def _set_data(self, project, name, data):
        if self.mode == "memory":
            if not self._memory[project]:
                self._memory[project] = defaultdict()
            self._memory[project][name] = data
            return

        path = os.path.join(self._get_project_path(project), f"{name}.json")
        with open(path, "w") as f:
            f.write(json.dumps(data))

    def _get_data(self, project, name):
        if self.mode == "memory":
            if not self._memory[project]:
                self._memory[project] = defaultdict()
            return self._memory[project].get(name)

        path = os.path.join(self._get_project_path(project), f"{name}.json")
        if not os.path.exists(path):
            return None

        with open(path) as f:
            return json.loads(f.read())
