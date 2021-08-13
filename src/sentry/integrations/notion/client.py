from django.utils.encoding import force_bytes

from sentry import options
from sentry_plugins.client import ApiClient

DATABASES = "/search"
PAGES = "/pages"
GET_PAGE = "/pages/%s"
APPEND_BLOCK = "/blocks/%s/children"
OAUTH = "/oauth/token"

NOTION_VERSION = "2021-05-13"
NOTION_API_URL = "https://api.notion.com/v1"


class NotionApiClient(ApiClient):
    base_url = NOTION_API_URL
    plugin_name = "notion"

    def __init__(self, api_key=None, **kwargs):
        self.api_key = api_key
        super().__init__(**kwargs)

    def request(self, method="GET", path="", data=None, params=None, **kwargs):
        params = {} if params is None else params.copy()
        headers = {}
        headers["Authorization"] = "Bearer " + self.api_key
        headers["Notion-Version"] = NOTION_VERSION
        return self._request(method, path, data=data, params=params, headers=headers, **kwargs)

    def authenticate(self, code, redirect_uri, **kwargs):
        from base64 import b64encode

        client_id = options.get("notion-app.client-id")
        client_secret = options.get("notion-app.client-secret")
        encoded_auth_string = b"Basic " + b64encode(force_bytes(client_id + ":" + client_secret))

        headers = {}
        headers["Authorization"] = encoded_auth_string
        headers["Notion-Version"] = NOTION_VERSION
        data = {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri}

        return self._request(method="POST", path=OAUTH, data=data, headers=headers, **kwargs)

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
        data = {"filter": {"value": "page", "property": "object"}}
        if query is not None:
            data["query"] = query

        return self.request(path=DATABASES, method="POST", data=data)

    def get_page(self, page_id):
        return self.request(path=GET_PAGE % page_id, method="GET")

    def append_block(self, page_id, comment):
        data = {
            "children": [
                {
                    "object": "block",
                    "type": "heading_3",
                    "heading_3": {
                        "text": [
                            {"type": "text", "text": {"content": "Sentry integration: "}},
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
