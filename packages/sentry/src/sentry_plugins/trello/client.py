from sentry_plugins.client import ApiClient

ORG_BOARD_PATH = "/organizations/%s/boards"
MEMBER_ORG_PATH = "/members/me/organizations"
LISTS_OF_BOARD_PATH = "/boards/%s/lists"
NEW_CARD_PATH = "/cards"
SINGLE_CARD_PATH = "/cards/%s"
ADD_COMMENT_PATH = "/cards/%s/actions/comments"
MEMBER_BOARD_PATH = "/members/me/boards"
SEARCH_PATH = "/search"

CARD_FIELDS = ",".join(["name", "shortLink", "idShort"])


class TrelloApiClient(ApiClient):
    base_url = "https://api.trello.com/1"
    plugin_name = "trello"

    def __init__(self, api_key, token=None, **kwargs):
        self.api_key = api_key
        self.token = token
        super().__init__(**kwargs)

    def request(self, method="GET", path="", data=None, params=None, **kwargs):
        params = {} if params is None else params.copy()
        params["token"] = self.token
        params["key"] = self.api_key
        return self._request(method, path, data=data, params=params, **kwargs)

    def get_organization_boards(self, org_id_or_name, fields=None):
        """
        Return boards for an organization/team
        """
        return self.request(path=ORG_BOARD_PATH % (org_id_or_name), params={"fields": fields})

    def get_member_boards(self, fields=None):
        """
        Return boards for a user
        """
        return self.request(path=MEMBER_BOARD_PATH, params={"fields": fields})

    def get_boards(self, org=None):
        """
        Return boards for an organization/team if set, otherwise return boards for user
        """
        if org:
            return self.get_organization_boards(org, fields="name")
        return self.get_member_boards(fields="name")

    def get_organization_list(self, fields=None):
        """
        Return organization list for user
        """
        return self.request(path=MEMBER_ORG_PATH, params={"fields": fields})

    def get_lists_of_board(self, board_id, fields=None):
        """
        Return the lists on a given board
        """
        return self.request(path=LISTS_OF_BOARD_PATH % (board_id), params={"fields": fields})

    def new_card(self, name, id_list, desc=None):
        """
        Create a Trello card
        """
        return self.request(
            method="POST", path=NEW_CARD_PATH, data={"name": name, "idList": id_list, "desc": desc}
        )

    def get_organization_options(self):
        """
        Return organization options to use in a Django form
        """
        organizations = self.get_organization_list(fields="name")
        return [(org["id"], org["name"]) for org in organizations]

    def get_cards(self, query, org_id=None):
        """
        Return the cards matching a query, limited to an org if passed in
        """
        params = {
            "query": query,
            "modelTypes": "cards",
            "cards_limit": 100,
            "partial": "true",
            "card_fields": CARD_FIELDS,
        }
        if org_id:
            params["idOrganizations"] = org_id
        response = self.request(path=SEARCH_PATH, params=params)
        return response["cards"]

    def get_card(self, card_id_or_short_link):
        """
        Return a card from an ID or short link
        """
        return self.request(
            path=SINGLE_CARD_PATH % card_id_or_short_link, params={"fields": CARD_FIELDS}
        )

    def create_comment(self, card_id_or_short_link, comment):
        """
        Create a comment on a card
        """
        return self.request(
            method="POST", path=ADD_COMMENT_PATH % card_id_or_short_link, params={"text": comment}
        )
