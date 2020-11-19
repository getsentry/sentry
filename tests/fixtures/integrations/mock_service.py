import os
import shutil

from collections import defaultdict
from sentry.utils import json

FIXTURE_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)))


class StubService(object):
    """
    A stub is a service that replicates the functionality of a real software
    system by returning valid data without actually implementing any business
    logic. For example, a stubbed random dice_roll function might always return
    6. Stubs can make tests simpler and more reliable because they can replace
    flaky or slow networks call or allow you to have wider coverage in end-to-
    end tests.
    """
    stub_data_cache = {}
    service_name = None

    @staticmethod
    def get_stub_json(service_name, name):
        path = os.path.join(FIXTURE_DIRECTORY, service_name, "stubs", name)
        with open(path, 'r') as f:
            return f.read()

    @staticmethod
    def get_stub_data(service_name, name):
        cache_key = "{}.{}".format(service_name, name)
        cached = StubService.stub_data_cache.get(cache_key)
        if cached:
            return cached
        data = json.loads(StubService.get_stub_json(service_name, name))
        StubService.stub_data_cache[cache_key] = data
        return data

    def _get_stub_data(self, name):
        return StubService.get_stub_data(self.service_name, name)


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
            self._memory[project][name] = data
            return

        path = os.path.join(self._get_project_path(project), "{}.json".format(name))
        with open(path, "w") as f:
            f.write(json.dumps(data))

    def _get_data(self, project, name):
        if self.mode == "memory":
            return self._memory[project][name]

        path = os.path.join(self._get_project_path(project), "{}.json".format(name))
        with open(path, 'r') as f:
            return json.loads(f.read())
