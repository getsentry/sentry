from __future__ import absolute_import

from sentry_plugins.client import ApiClient


class ClubhouseClient(ApiClient):
    base_url = u"https://api.clubhouse.io/api/v2"
    plugin_name = "clubhouse"

    def __init__(self, token):
        self.token = token
        super(ClubhouseClient, self).__init__()

    def request(self, method, path, data=None, params=None):
        params = {"token": self.token}
        return self._request(method, path, data=data, params=params)

    def get_story(self, story_id):
        return self.get("/stories/%s" % story_id)

    def create_story(self, project, data):
        story_data = {
            "project_id": project,
            "name": data["title"],
            "description": data["description"],
            "story_type": "bug",
        }
        return self.post("/stories", data=story_data)

    # returns [SearchResults] https://clubhouse.io/api/rest/v2/#SearchResults
    # containing a list of [StorySearch] results https://clubhouse.io/api/rest/v2/#StorySearch
    def search_stories(self, query):
        return self.get("/search/stories", data={"query": query})

    def add_comment(self, story_id, comment):
        story_url = "/stories/{}/comments".format(story_id)
        comment_data = {"text": comment}
        return self.post(story_url, data=comment_data)
