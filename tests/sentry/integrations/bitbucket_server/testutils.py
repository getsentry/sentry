from __future__ import absolute_import
from collections import OrderedDict

EXAMPLE_PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQC1cd9t8sA03awggLiX2gjZxyvOVUPJksLly1E662tttTeR3Wm9
eo6onNeI8HRD+O4wubUp4h4Chc7DtLDmFEPhUZ8Qkwztiifm99Xo3s0nUq4Pygp5
AU09KXTEPbzHLh1dnXLcxVLmGDE4drh0NWmYsd/Zp7XNIZq2TRQQ3NTdVQIDAQAB
AoGAFwMyS0eWiR30TssEnn3Q0Y4pSCoYRuCOR4bZ7pcdMPTi72UdnCKHJWt/Cqc0
l8piq1tiVsWO+NLvvnKUXRoE4cAyrGrpf1F0uP5zYW71SQALc9wwsjDzuj7BZEuK
fg35JSceLHWE1WtzPDX5Xg20YPnMrA/xe/RwuPjuBH0wSqECQQDizzmKdKCq0ejy
3OxEto5knqpSEgRcOk0HDsdgjwkwiZJOj5ECV2FKpNHuu2thGy/aDJyLlmUso8j0
OpvLAzOvAkEAzMwAgGexTxKm8hy3ilvVn9EvhSKjaIakqY4ONK9LZ4zMiDHI0H6C
FXlwWX7CJM0YVFMubj8SB8rnIuvFDEBMOwJABHtRyMGbNyTktH/XD1iIIcbc2LhQ
a74fLYeGOws4hEQDpxfBJsmxO3dcSppbedS+slFTepKjNymZW/IYh/9tMwJAEL5E
9DqGBn7x4y1x2//yESTbC7lvPqZzY+FXS/tg4NBkEGZxkoolPHg3NTnlyXhzGsHK
M/04DicKipJYA85l7QJAJ3u67qZXecM/oWTtJToBDuyKGHfdY1564+RbyDEjJJRb
vz4O/8FQQ1sGjdEBMMrRBCHEG8o3/XDTrB97t45TeA==
-----END RSA PRIVATE KEY-----"""

COMPARE_COMMITS_EXAMPLE = {
    "values": [
        {
            "id": "e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
            "displayId": "e18e4e72de0",
            "author": {
                "name": "SentryU",
                "displayName": "Sentry User",
                "emailAddress": "sentryuser@getsentry.com",
                "type": "NORMAL",
            },
            "message": "README.md edited online with Bitbucket",
            "authorTimestamp": 1576763816000,
        }
    ]
}

COMMIT_CHANGELIST_EXAMPLE = {
    "values": [
        {
            "path": {
                "components": ["a.txt"],
                "parent": "",
                "name": "a.txt",
                "extension": "txt",
                "toString": "a.txt",
            },
            "executable": False,
            "percentUnchanged": -1,
            "type": "MODIFY",
            "nodeType": "FILE",
            "srcExecutable": False,
            "properties": {"gitChangeType": "MODIFY"},
        },
        {
            "path": {
                "components": ["b.txt"],
                "parent": "",
                "name": "b.txt",
                "extension": "txt",
                "toString": "b.txt",
            },
            "executable": False,
            "percentUnchanged": -1,
            "type": "ADD",
            "nodeType": "FILE",
            "srcExecutable": False,
            "properties": {"gitChangeType": "ADD"},
        },
        {
            "path": {
                "components": ["c.txt"],
                "parent": "",
                "name": "c.txt",
                "extension": "txt",
                "toString": "c.txt",
            },
            "executable": False,
            "percentUnchanged": -1,
            "type": "DELETE",
            "nodeType": "FILE",
            "srcExecutable": False,
            "properties": {"gitChangeType": "DELETE"},
        },
        {
            "path": {
                "components": ["e.txt"],
                "parent": "",
                "name": "d.txt",
                "extension": "txt",
                "toString": "d.txt",
            },
            "srcPath": {
                "components": ["d.txt"],
                "parent": "",
                "name": "e.txt",
                "extension": "txt",
                "toString": "e.txt",
            },
            "executable": False,
            "percentUnchanged": -1,
            "type": "MOVE",
            "nodeType": "FILE",
            "srcExecutable": False,
            "properties": {"gitChangeType": "MOVE"},
        },
    ]
}

REPO = {
    u"slug": u"helloworld",
    u"id": 72,
    u"name": u"helloworld",
    u"scmId": u"git",
    u"state": u"AVAILABLE",
    u"statusMessage": u"Available",
    u"forkable": True,
    u"project": OrderedDict(
        [
            (u"key", u"laurynsentry"),
            (u"id", 75),
            (u"name", u"laurynsentry"),
            (u"description", u""),
            (u"public", False),
            (u"type", u"Normal"),
            (
                u"links",
                OrderedDict(
                    [
                        (
                            u"self",
                            OrderedDict(
                                [(u"href", u"https://bitbucket.example.org/projects/laurynsentry")]
                            ),
                        )
                    ]
                ),
            ),
        ]
    ),
    u"public": False,
    u"links": OrderedDict(
        [
            (
                u"clone",
                OrderedDict(
                    [
                        OrderedDict(
                            [
                                (
                                    u"href",
                                    u"https://bitbucket.example.org/scm/laurynsentry/helloworld.git",
                                ),
                                (u"name", u"http"),
                            ]
                        ),
                        OrderedDict(
                            [
                                (
                                    u"href",
                                    u"ssh://git@bitbucket.example.org:7999/laurynsentry/helloworld.git",
                                ),
                                (u"name", u"ssh"),
                            ]
                        ),
                    ]
                ),
            ),
            (
                u"self",
                OrderedDict(
                    [
                        (
                            u"href",
                            u"https://bitbucket.example.org/projects/laurynsentry/repos/helloworld/browse",
                        )
                    ]
                ),
            ),
        ]
    ),
}


COMPARE_COMMITS_WITH_PAGES_1_2_EXAMPLE = {
    "values": [
        {
            "id": "d0352305beb41afb3a4ea79e3a97bf6a97520339",
            "displayId": "d0352305beb",
            "author": {
                "name": "SentryU",
                "displayName": "Sentry User",
                "emailAddress": "sentryuser@getsentry.com",
                "type": "NORMAL",
            },
            "message": "Fist commit",
            "authorTimestamp": 1576763816000,
        }
    ],
    "size": 1,
    "isLastPage": False,
    "start": 0,
    "limit": 1,
    "nextPageStart": 1,
}

COMPARE_COMMITS_WITH_PAGES_2_2_EXAMPLE = {
    "values": [
        {
            "id": "042bc8434e0c178d8745c7d9f90bddab9c927887",
            "displayId": "042bc8434e0",
            "author": {
                "name": "SentryU",
                "displayName": "Sentry User",
                "emailAddress": "sentryuser@getsentry.com",
                "type": "NORMAL",
            },
            "message": "Second commit",
            "authorTimestamp": 1576763816000,
        }
    ],
    "size": 1,
    "isLastPage": True,
    "start": 1,
    "limit": 1,
    "nextPageStart": None,
}

COMMIT_CHANGELIST_WITH_PAGES_FIRST_COMMIT_EXAMPLE = {
    "values": [
        {
            "path": {
                "components": ["a.txt"],
                "parent": "",
                "name": "a.txt",
                "extension": "txt",
                "toString": "a.txt",
            },
            "executable": False,
            "percentUnchanged": -1,
            "type": "MODIFY",
            "nodeType": "FILE",
            "srcExecutable": False,
            "properties": {"gitChangeType": "MODIFY"},
        },
        {
            "path": {
                "components": ["b.txt"],
                "parent": "",
                "name": "b.txt",
                "extension": "txt",
                "toString": "b.txt",
            },
            "executable": False,
            "percentUnchanged": -1,
            "type": "ADD",
            "nodeType": "FILE",
            "srcExecutable": False,
            "properties": {"gitChangeType": "ADD"},
        },
    ]
}

COMMIT_CHANGELIST_WITH_PAGES_SECOND_COMMIT_EXAMPLE_1_2 = {
    "values": [
        {
            "path": {
                "components": ["c.txt"],
                "parent": "",
                "name": "c.txt",
                "extension": "txt",
                "toString": "c.txt",
            },
            "executable": False,
            "percentUnchanged": -1,
            "type": "DELETE",
            "nodeType": "FILE",
            "srcExecutable": False,
            "properties": {"gitChangeType": "DELETE"},
        }
    ],
    "size": 1,
    "isLastPage": False,
    "start": 0,
    "limit": 1,
    "nextPageStart": 1,
}

COMMIT_CHANGELIST_WITH_PAGES_SECOND_COMMIT_EXAMPLE_2_2 = {
    "values": [
        {
            "path": {
                "components": ["e.txt"],
                "parent": "",
                "name": "d.txt",
                "extension": "txt",
                "toString": "d.txt",
            },
            "srcPath": {
                "components": ["d.txt"],
                "parent": "",
                "name": "e.txt",
                "extension": "txt",
                "toString": "e.txt",
            },
            "executable": False,
            "percentUnchanged": -1,
            "type": "MOVE",
            "nodeType": "FILE",
            "srcExecutable": False,
            "properties": {"gitChangeType": "MOVE"},
        },
    ],
    "size": 1,
    "isLastPage": True,
    "start": 1,
    "limit": 1,
    "nextPageStart": None,
}
