from fixtures.integrations.jira.stub_client import StubJiraApiClient
from fixtures.integrations.mock_service import MockService

DEFAULT_PROJECT_ID = "10000"


class MockJira(StubJiraApiClient, MockService):
    def get_projects_list(self):
        """
        List all projects in the Jira data format.

        :return: list of project objects
        """
        return [
            {
                "self": f"http://www.example.com/jira/rest/api/2/project/{project_name}",
                "id": project_name,
                "key": project_name,
                "name": project_name,
                "projectCategory": {
                    "self": f"http://www.example.com/jira/rest/api/2/projectCategory/{project_name}",
                    "id": project_name,
                    "name": project_name,
                    "description": project_name,
                },
                "simplified": False,
            }
            for project_name in self._get_project_names() + [DEFAULT_PROJECT_ID]
        ]

    def set_createmeta(self, project, createmeta):
        """
        This special method lets you seed the stub data with your own metadata.
        # TODO validate createmeta

        :param project:
        :param createmeta:
        :return:
        """
        return self._set_data(project, "createmeta", createmeta)

    def get_create_meta_for_project(self, project):
        """
        Get the Jira "createmeta" for a project.

        :param project: String name of a Jira project
        :return: Object containing the "createmeta" of the project.
        """
        self._throw_if_broken()

        createmeta = self._get_data(project, "createmeta")
        if createmeta:
            return createmeta

        # Fallback to stub data
        return super().get_create_meta_for_project(project)

    def create_issue(self, raw_form_data):
        """
        Create a new Jira issue. Currently overwrites if the issue already exists.

        :param raw_form_data: Object containing issue parameters
        :return: Object containing the newly created ticket's "key" as a string.
        """
        self._throw_if_broken()

        project = raw_form_data.get("project", {}).get("id")
        ticket_key = self._get_new_ticket_name(project)
        self._set_data(project, ticket_key, {"fields": raw_form_data})

        return {"key": ticket_key}

    def get_issue(self, issue_key):
        """
        Get a saved issue from Jira.

        :param issue_key: string
        :return: Object containing Jira Issue data
        """
        project = issue_key.split("-")[0]
        data = self._get_data(project, issue_key)
        if not data:
            return None

        data.update(
            {
                "id": issue_key,
                "key": issue_key,
            }
        )
        return data
