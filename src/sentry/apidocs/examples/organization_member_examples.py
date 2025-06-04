from drf_spectacular.utils import OpenApiExample

ORGANIZATION_MEMBER = {
    "id": "57377908164",
    "email": "sirpenguin@antarcticarocks.com",
    "name": "Sir Penguin",
    "user": {
        "id": "280094367316",
        "name": "Sir Penguin",
        "username": "sirpenguin@antarcticarocks.com",
        "email": "sirpenguin@antarcticarocks.com",
        "avatarUrl": "https://secure.gravatar.com/avatar/16aeb26c5fdba335c7078e9e9ddb5149?s=32&d=mm",
        "isActive": True,
        "hasPasswordAuth": True,
        "isManaged": False,
        "dateJoined": "2021-07-06T21:13:58.375239Z",
        "lastLogin": "2021-08-02T18:25:00.051182Z",
        "has2fa": False,
        "lastActive": "2021-08-02T21:32:18.836829Z",
        "isSuperuser": False,
        "isStaff": False,
        "experiments": {},
        "emails": [
            {
                "id": "2153450836",
                "email": "sirpenguin@antarcticarocks.com",
                "is_verified": True,
            }
        ],
        "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
        "canReset2fa": True,
    },
    "orgRole": "member",
    "pending": False,
    "expired": False,
    "flags": {
        "idp:provisioned": False,
        "idp:role-restricted": False,
        "sso:linked": False,
        "sso:invalid": False,
        "member-limit:restricted": False,
        "partnership:restricted": False,
    },
    "dateCreated": "2021-07-06T21:13:01.120263Z",
    "inviteStatus": "approved",
    "inviterName": "maininviter@antarcticarocks.com",
}

INVITED_ORGANIZATION_MEMBER = {
    "id": "57377908165",
    "email": "rockhopper@antarcticarocks.com",
    "name": "Rockhopper",
    "orgRole": "member",
    "pending": True,
    "expired": False,
    "flags": {
        "idp:provisioned": False,
        "idp:role-restricted": False,
        "sso:linked": False,
        "sso:invalid": False,
        "member-limit:restricted": False,
        "partnership:restricted": False,
    },
    "dateCreated": "2021-07-07T21:13:01.120263Z",
    "inviteStatus": "pending",
    "inviterName": "maininviter@antarcticarocks.com",
}


class OrganizationMemberExamples:
    CREATE_ORG_MEMBER = [
        OpenApiExample(
            "Add a member to an organization",
            value=ORGANIZATION_MEMBER,
            status_codes=["201"],
            response_only=True,
        )
    ]

    LIST_ORG_MEMBERS = [
        OpenApiExample(
            "List organization members",
            value=[ORGANIZATION_MEMBER, INVITED_ORGANIZATION_MEMBER],
            status_codes=["200"],
            response_only=True,
        )
    ]
