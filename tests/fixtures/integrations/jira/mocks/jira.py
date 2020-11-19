from sentry.shared_integrations.exceptions import ApiError
from tests.fixtures.integrations.mock_service import MockService, StubService


class StubJiraApiClient(StubService):
    service_name = "jira"

    def get_create_meta_for_project(self, project):
        response = self._get_stub_data("createmeta_response.json")
        if project == "10001":
            response["projects"][0]["id"] = "10001"
        return response["projects"][0]

    def get_projects_list(self):
        return self._get_stub_data("project_list_response.json")

    def get_issue(self, issue_key):
        return self._get_stub_data("get_issue_response.json")

    def create_comment(self, issue_id, comment):
        return comment

    def update_comment(self, issue_key, comment_id, comment):
        return comment

    def create_issue(self, data):
        return {"key": "APP-123"}

    def get_transitions(self, issue_key):
        return self._get_stub_data("transitions_response.json")["transitions"]

    def transition_issue(self, issue_key, transition_id):
        pass

    def user_id_field(self):
        return "accountId"

    def get_user(self, user_id):
        user = self._get_stub_data("user.json")
        if user["accountId"] == user_id:
            return user
        raise ApiError("no user found")


class MockJira(StubJiraApiClient, MockService):
    def get_projects_list(self):
        """

        :return:
        """
        # TODO MARCOS
        return self._get_stub_data("project_list_response.json")

    def set_createmeta(self, project, createmeta):
        """
        This special method lets you seed the stub data with your own metadata.

        :param project:
        :param createmeta:
        :return:
        """
        # TODO validate createmeta

        return self._set_data(project, "createmeta", createmeta)

    def get_create_meta_for_project(self, project):
        """
        TODO MARCOS DESCRIBE

        :param project:
        :return:
        """
        self._throw_if_broken()

        createmeta = self._get_data(project, "createmeta")
        if createmeta:
            return createmeta

        # Use stub data
        return super(MockJira).get_create_meta_for_project(project)

    def create_issue(self, data):
        """

        :param data:
        :return:
        """
        self._throw_if_broken()

        project = data.get("project")

        ticket_name = self._get_new_ticket_name(project)
        return self._set_data(project, ticket_name,  data)

    def get_issue(self, issue_key):
        """

        :param issue_key:
        :return:
        """
        return self._get_stub_data("get_issue_response.json")
