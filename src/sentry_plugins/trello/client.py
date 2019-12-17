from __future__ import absolute_import


from sentry_plugins.client import ApiClient


org_board_path = "/organizations/%s/boards"
member_org_path = "/members/me/organizations"
lists_of_board_path = "/boards/%s/lists"
new_card_path = "/cards"
single_card_path = "/cards/%s"
add_comment_path = "/cards/%s/actions/comments"
member_board_path = "/members/me/boards"
search_path = "/search"

card_fields = "name,shortLink,idShort"


class TrelloApiClient(ApiClient):
    base_url = "https://api.trello.com/1"
    plugin_name = "trello"

    def __init__(self, api_key, token=None, timeout=5):
        self.api_key = api_key
        self.token = token
        self.timeout = timeout
        super(TrelloApiClient, self).__init__()

    def request(self, method="GET", path="", data=None, params=None):
        if params is None:
            params = {}
        params["token"] = self.token
        params["key"] = self.api_key
        print (path, data, params)
        out = self._request(method, path, data=data, params=params)
        import json

        print (json.dumps(out))
        return out

    def get_organization_boards(self, org_id_or_name, fields=None):
        return self.request(path=org_board_path % (org_id_or_name), params={"fields": fields})

    def get_member_boards(self, fields=None):
        return self.request(path=member_board_path, params={"fields": fields})

    def get_boards(self, org=None):
        if org:
            return self.get_organization_boards(org, fields="name")
        return self.get_member_boards(fields="name")

    def get_organization_list(self, fields=None):
        return self.request(path=member_org_path, params={"fields": fields})

    def get_lists_of_board(self, board_id, fields=None):
        return self.request(path=lists_of_board_path % (board_id), params={"fields": fields})

    def new_card(self, name, idList, desc=None):
        return self.request(
            method="POST", path=new_card_path, data={"name": name, "idList": idList, "desc": desc}
        )

    def get_organization_options(self):
        organizations = self.get_organization_list(fields="name")
        return map(lambda org: (org["id"], org["name"]), organizations)

    def get_cards(self, query, org_id=None):
        params = {
            "query": query,
            "modelTypes": "cards",
            "cards_limit": 100,
            "partial": "true",
            "card_fields": card_fields,
        }
        if org_id:
            params["idOrganizations"] = org_id
        out = self.request(path=search_path, params=params)
        return out["cards"]

    def get_card(self, card_short_link):
        return self.request(path=single_card_path % card_short_link, params={"fields": card_fields})

    def create_comment(self, card_short_link, comment):
        return self.request(
            method="POST", path=add_comment_path % card_short_link, params={"text": comment}
        )
