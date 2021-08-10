from sentry_plugins.client import ApiClient

DATABASES = "/search"
PAGES = "/pages"
GET_PAGE = "/pages/%s"
APPEND_BLOCK = "/blocks/%s/children"

NOTION_VERSION = "2021-05-13"


class NotionApiClient(ApiClient):
    base_url = "https://api.notion.com/v1"
    plugin_name = "notion"

    def __init__(self, api_key, **kwargs):
        self.api_key = api_key
        super().__init__(**kwargs)

    def request(self, method="GET", path="", data=None, params=None, **kwargs):
        params = {} if params is None else params.copy()
        headers = {}
        headers["Authorization"] = "Bearer " + self.api_key
        headers["Notion-Version"] = NOTION_VERSION
        return self._request(method, path, data=data, params=params, headers=headers, **kwargs)

    def get_databases(self):
        """
        Query databases in Notion
        """
        data = {"filter": {"value": "database", "property": "object"}}
        return self.request(path=DATABASES, method="POST", data=data)

    def get_databases_list(self):
        """
        Return databases options to use in a Django form
        """
        databases = self.get_databases()
        return [(db["id"], db["title"][0]["plain_text"]) for db in databases["results"]]

    def create_page(self, data):
        """
        Add issue to the Notion database
        """
        return self.request(method="POST", path=PAGES, data=data)

    def get_pages(self, query=None):
        """
        Query databases in Notion
        """
        data = {"filter": {"value": "page", "property": "object"}, "query": query}
        return self.request(path=DATABASES, method="POST", data=data)

    def get_page(self, page_id):
        return self.request(path=GET_PAGE % page_id, method="GET")

    def append_block(self, page_id, comment, issue_id, url):
        data = {
            "children": [
                {
                    "object": "block",
                    "type": "heading_3",
                    "heading_3": {
                        "text": [
                            {"type": "text", "text": {"content": "Sentry issue: "}},
                            {"type": "text", "text": {"content": issue_id, "link": {"url": url}}},
                        ]
                    },
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": comment,
                                },
                            }
                        ]
                    },
                },
            ]
        }
        return self.request(path=APPEND_BLOCK % page_id, method="PATCH", data=data)
