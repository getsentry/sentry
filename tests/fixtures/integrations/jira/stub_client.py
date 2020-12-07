from sentry.shared_integrations.exceptions import ApiError
from tests.fixtures.integrations import StubService


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

    def create_issue(self, raw_form_data):
        return {"key": "APP-123"}

    def get_transitions(self, issue_key):
        return self._get_stub_data("transition_response.json")["transitions"]

    def transition_issue(self, issue_key, transition_id):
        pass

    def user_id_field(self):
        return "accountId"

    def get_user(self, user_id):
        user = self._get_stub_data("user.json")
        if user["accountId"] == user_id:
            return user
        raise ApiError("no user found")
