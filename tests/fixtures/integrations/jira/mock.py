from tests.fixtures.integrations.jira import StubJiraApiClient
from tests.fixtures.integrations import MockService


class MockJira(StubJiraApiClient, MockService):
    def get_projects_list(self):
        """
        List all projects in the Jira data format.

        :return: list of project objects
        """
        return [{
            "self": "http://www.example.com/jira/rest/api/2/project/{}".format(project_name),
            "id": project_name,
            "key": project_name,
            "name": project_name,
            "projectCategory": {
                "self": "http://www.example.com/jira/rest/api/2/projectCategory/{}".format(project_name),
                "id": project_name,
                "name": project_name,
                "description": project_name
            },
            "simplified": False
        } for project_name in self._get_project_names()]

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
        return super(MockJira, self).get_create_meta_for_project(project)

    def create_issue(self, raw_form_data):
        """

        :param raw_form_data:
        :return:
        """
        self._throw_if_broken()

        project = raw_form_data.get("project", {}).get("id")
        data = {"fields": raw_form_data}
        ticket_name = self._get_new_ticket_name(project)
        self._set_data(project, ticket_name,  data)

        return {"key": ticket_name}

    def get_issue(self, issue_key):
        """

        :param issue_key:
        :return:
        """
        return self._get_stub_data("get_issue_response.json")
