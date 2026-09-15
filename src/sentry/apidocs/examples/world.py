"""
The one organization every OpenAPI example is drawn from.

Examples attached to endpoints via ``@extend_schema(examples=...)`` are also
exported to the frontend as fixture data, where a story or test renders several
of them together. That only reads coherently when they describe the same world:
the project an issue belongs to exists in the projects list, its team exists in
the teams list, the member who commented exists in the members list.

Compose examples from these constants instead of inventing identities. ``ref``
builds the ``{id, name, slug}`` summary most responses embed for a related
object. Add a new entity here when an example needs one that does not exist
yet, rather than declaring it inline.
"""

from __future__ import annotations

from typing import Any

ORGANIZATION = {
    "id": "4505320923660288",
    "slug": "the-interstellar-jurisdiction",
    "name": "The Interstellar Jurisdiction",
    "dateCreated": "2018-11-06T21:19:55.101Z",
}

TEAM_BACKEND = {
    "id": "4502349234123",
    "slug": "powerful-abolitionist",
    "name": "Powerful Abolitionist",
    "dateCreated": "2018-10-03T17:47:50.745447Z",
}

TEAM_FRONTEND = {
    "id": "4502349234125",
    "slug": "ancient-gabelers",
    "name": "Ancient Gabelers",
    "dateCreated": "2023-05-31T19:47:53.621181Z",
}

PROJECT_BACKEND = {
    "id": "4505278496",
    "slug": "pump-station",
    "name": "Pump Station",
    "platform": "python",
    "dateCreated": "2021-01-14T22:08:52.711809Z",
}

PROJECT_FRONTEND = {
    "id": "4505321021243392",
    "slug": "the-spoiled-yoghurt",
    "name": "The Spoiled Yoghurt",
    "platform": "javascript",
    "dateCreated": "2023-06-08T00:13:06.004534Z",
}

USER_OWNER = {
    "id": "280094367316",
    "name": "Sir Penguin",
    "username": "sirpenguin@antarcticarocks.com",
    "email": "sirpenguin@antarcticarocks.com",
}

USER_INVITED = {
    "id": "280094367317",
    "name": "Rockhopper",
    "username": "rockhopper@antarcticarocks.com",
    "email": "rockhopper@antarcticarocks.com",
}

# Organization membership ids are distinct from user ids.
MEMBER_OWNER = {"id": "57377908164", "email": USER_OWNER["email"], "name": USER_OWNER["name"]}
MEMBER_INVITED = {
    "id": "57377908165",
    "email": USER_INVITED["email"],
    "name": USER_INVITED["name"],
}

ORGANIZATION_URL = f"https://{ORGANIZATION['slug']}.sentry.io"
REGION_URL = "https://us.sentry.io"


def ref(entity: dict[str, Any]) -> dict[str, str]:
    """The ``{id, name, slug}`` summary a response embeds for a related object."""
    return {"id": entity["id"], "name": entity["name"], "slug": entity["slug"]}
