import json
import os
import shutil

from collections import defaultdict

from tests.fixtures.integrations import FIXTURE_DIRECTORY
from tests.fixtures.integrations.stub_service import StubService


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
        super(MockService, self).__init__()
        self.mode = mode
        self._next_error_code = None
        self._next_ids = defaultdict(lambda: 0)

        if self.mode == "file":
            path = os.path.join(FIXTURE_DIRECTORY, "integrations", self.service_name)
            # TODO Undo commenting out
            # TODO add this path to gitignore
            # if os.path.exists(path):
            #     shutil.rmtree(path)
            os.makedirs(path)
        else:
            self._memory = defaultdict(dict)

    def add_project(self, project):
        """
        TODO RENAME project

        :param project:
        :return:
        """
        self._next_ids.get(project)  # touch
        if self.mode == "file":
            self._get_project_path(project)

    def remove_project(self, project):
        """
        TODO DESCRIBE

        :param project:
        :return:
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

    def _throw_if_broken(self):
        """
        See break_next_api_call.
        :raises: TODO
        """
        if self._next_error_code:
            self._next_error_code = None
            raise Exception("{}: {} is down".format(self._next_error_code, self.service_name))

    def _get_project_names(self):
        return self._next_ids.keys()

    def _get_new_ticket_name(self, project):
        counter = self._next_ids[project]
        self._next_ids[project] = counter + 1

        # TODO make this alphanumeric
        return str(counter)

    def _get_project_path(self, project):
        # TODO Should we keep track of projects in memory?
        path = os.path.join(FIXTURE_DIRECTORY, "integrations", self.service_name, project)

        if not os.path.exists(path):
            os.makedirs(path)
        return path

    def _set_data(self, project, name, data):
        if self.mode == "memory":
            if not self._memory[project]:
                self._memory[project] = defaultdict()
            self._memory[project][name] = data
            return

        path = os.path.join(self._get_project_path(project), "{}.json".format(name))
        with open(path, "w") as f:
            f.write(json.dumps(data, sort_keys=True, indent=4))

    def _get_data(self, project, name):
        if self.mode == "memory":
            if not self._memory[project]:
                self._memory[project] = defaultdict()
            return self._memory[project].get(name)

        path = os.path.join(self._get_project_path(project), "{}.json".format(name))
        with open(path, 'r') as f:
            return json.loads(f.read())
