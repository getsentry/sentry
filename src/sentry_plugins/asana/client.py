from sentry_plugins.client import AuthApiClient


class AsanaClient(AuthApiClient):
    base_url = "https://app.asana.com/api/1.0"
    plugin_name = "asana"

    def get_workspaces(self):
        return self.get("/workspaces")

    def get_issue(self, issue_id):
        return self.get("/tasks/%s" % issue_id)

    def create_issue(self, workspace, data):
        asana_data = {
            "name": data["title"],
            "notes": data["description"],
            "workspace": str(workspace),
        }
        if data.get("project"):
            asana_data["projects"] = [str(data["project"])]

        if data.get("assignee"):
            asana_data["assignee"] = str(data["assignee"])

        return self.post("/tasks", data={"data": asana_data})

    def create_comment(self, issue_id, data):
        return self.post("/tasks/%s/stories/" % issue_id, data={"data": data})

    def search(self, workspace, object_type, query):
        return self.get(
            "/workspaces/%s/typeahead" % workspace, params={"type": object_type, "query": query}
        )
