COMPARE_COMMITS_EXAMPLE = b"""{
"pagelen": 30,
 "values":
     [{"hash": "e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
      "repository": {"links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs"}, "avatar": {"href": "https://bitbucket.org/sentryuser/newsdiffs/avatar/32/"}}, "type": "repository", "name": "newsdiffs", "full_name": "sentryuser/newsdiffs", "uuid": "{c78dfb25-7882-4550-97b1-4e0d38f32859}"}, "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "comments": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/comments"}, "patch": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/patch/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "diff": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/diff/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "approve": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/approve"}, "statuses": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/statuses"}},
       "author": {
            "raw": "Sentry User <sentryuser@getsentry.com>",
            "type": "author"
        },
        "parents": [{"hash": "26de9b63d09aa9c787e899f149c672023e292925", "type": "commit", "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/26de9b63d09aa9c787e899f149c672023e292925"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs/commits/26de9b63d09aa9c787e899f149c672023e292925"}}}], "date": "2017-05-16T23:21:40+00:00", "message": "README.md edited online with Bitbucket", "type": "commit"}],
  "next": "https://api.bitbucket.org/2.0/repositories/sentryuser/sentryrepo/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301?page=2"
}
"""

GET_LAST_COMMITS_EXAMPLE = b"""{
"pagelen": 30,
 "values":
     [{"hash": "e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
      "repository": {"links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs"}, "avatar": {"href": "https://bitbucket.org/sentryuser/newsdiffs/avatar/32/"}}, "type": "repository", "name": "newsdiffs", "full_name": "sentryuser/newsdiffs", "uuid": "{c78dfb25-7882-4550-97b1-4e0d38f32859}"}, "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "comments": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/comments"}, "patch": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/patch/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "diff": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/diff/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "approve": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/approve"}, "statuses": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/statuses"}}, "author": {"raw": "Sentry User <sentryuser@getsentry.com>", "type": "author", "user": {"username": "sentryuser", "display_name": "Sentry User", "type": "user", "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}", "links": {"self": {"href": "https://api.bitbucket.org/2.0/users/sentryuser"}, "html": {"href": "https://bitbucket.org/sentryuser/"}, "avatar": {"href": "https://bitbucket.org/account/sentryuser/avatar/32/"}}}}, "parents": [{"hash": "26de9b63d09aa9c787e899f149c672023e292925", "type": "commit", "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/26de9b63d09aa9c787e899f149c672023e292925"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs/commits/26de9b63d09aa9c787e899f149c672023e292925"}}}], "date": "2017-05-16T23:21:40+00:00", "message": "README.md edited online with Bitbucket", "type": "commit"}],
  "next": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301?page=2"
}
"""

COMMIT_DIFF_PATCH = rb"""diff --git a/README.md b/README.md
index 89821ce..9e09a8a 100644
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-A twitter bot to when words are said by the NYT for the first time.
\ No newline at end of file
+A twitter bot to when words are said by the NYT for the first time.sdfsdf
\ No newline at end of file"""

PUSH_EVENT_EXAMPLE = b"""{
    "push": {
        "changes": [
            {
                "links": {
                    "html": {
                        "href": "https://bitbucket.org/maxbittker/newsdiffs/branches/compare/e0e377d186e4f0e937bdb487a23384fe002df649..8f5952f4dcffd7b311181d48eb0394b0cca21410"
                    },
                    "commits": {
                        "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commits?include=e0e377d186e4f0e937bdb487a23384fe002df649&exclude=8f5952f4dcffd7b311181d48eb0394b0cca21410"
                    },
                    "diff": {
                        "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/diff/e0e377d186e4f0e937bdb487a23384fe002df649..8f5952f4dcffd7b311181d48eb0394b0cca21410"
                    }
                },
                "commits": [
                    {
                        "links": {
                            "approve": {
                                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649/approve"
                            },
                            "statuses": {
                                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649/statuses"
                            },
                            "comments": {
                                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649/comments"
                            },
                            "self": {
                                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649"
                            },
                            "patch": {
                                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/patch/e0e377d186e4f0e937bdb487a23384fe002df649"
                            },
                            "html": {
                                "href": "https://bitbucket.org/maxbittker/newsdiffs/commits/e0e377d186e4f0e937bdb487a23384fe002df649"
                            },
                            "diff": {
                                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/diff/e0e377d186e4f0e937bdb487a23384fe002df649"
                            }
                        },
                        "date": "2017-05-24T01:05:47+00:00",
                        "hash": "e0e377d186e4f0e937bdb487a23384fe002df649",
                        "parents": [
                            {
                                "type": "commit",
                                "links": {
                                    "html": {
                                        "href": "https://bitbucket.org/maxbittker/newsdiffs/commits/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                                    },
                                    "self": {
                                        "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                                    }
                                },
                                "hash": "8f5952f4dcffd7b311181d48eb0394b0cca21410"
                            }
                        ],
                        "type": "commit",
                        "message": "README.md edited online with Bitbucket",
                        "author": {
                            "type": "author",
                            "user": {
                                "type": "user",
                                "display_name": "Max Bittker",
                                "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}",
                                "username": "maxbittker",
                                "links": {
                                    "html": {
                                        "href": "https://bitbucket.org/maxbittker/"
                                    },
                                    "avatar": {
                                        "href": "https://bitbucket.org/account/maxbittker/avatar/32/"
                                    },
                                    "self": {
                                        "href": "https://api.bitbucket.org/2.0/users/maxbittker"
                                    }
                                }
                            },
                            "raw": "Max Bittker <max@getsentry.com>"
                        }
                    }
                ],
                "old": {
                    "type": "branch",
                    "links": {
                        "html": {
                            "href": "https://bitbucket.org/maxbittker/newsdiffs/branch/master"
                        },
                        "commits": {
                            "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commits/master"
                        },
                        "self": {
                            "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/refs/branches/master"
                        }
                    },
                    "target": {
                        "links": {
                            "html": {
                                "href": "https://bitbucket.org/maxbittker/newsdiffs/commits/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                            },
                            "self": {
                                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                            }
                        },
                        "date": "2017-05-19T22:53:22+00:00",
                        "hash": "8f5952f4dcffd7b311181d48eb0394b0cca21410",
                        "parents": [
                            {
                                "type": "commit",
                                "links": {
                                    "html": {
                                        "href": "https://bitbucket.org/maxbittker/newsdiffs/commits/1cdfa36e62e615cdc73a1d5fcff1c706965b186d"
                                    },
                                    "self": {
                                        "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/1cdfa36e62e615cdc73a1d5fcff1c706965b186d"
                                    }
                                },
                                "hash": "1cdfa36e62e615cdc73a1d5fcff1c706965b186d"
                            }
                        ],
                        "type": "commit",
                        "message": "README.md edited online with Bitbucket",
                        "author": {
                            "type": "author",
                            "raw": "Max Bittker <max@getsentry.com>"
                        }
                    },
                    "name": "master"
                },
                "truncated": false,
                "new": {
                    "type": "branch",
                    "links": {
                        "html": {
                            "href": "https://bitbucket.org/maxbittker/newsdiffs/branch/master"
                        },
                        "commits": {
                            "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commits/master"
                        },
                        "self": {
                            "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/refs/branches/master"
                        }
                    },
                    "target": {
                        "links": {
                            "html": {
                                "href": "https://bitbucket.org/maxbittker/newsdiffs/commits/e0e377d186e4f0e937bdb487a23384fe002df649"
                            },
                            "self": {
                                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649"
                            }
                        },
                        "date": "2017-05-24T01:05:47+00:00",
                        "hash": "e0e377d186e4f0e937bdb487a23384fe002df649",
                        "parents": [
                            {
                                "type": "commit",
                                "links": {
                                    "html": {
                                        "href": "https://bitbucket.org/maxbittker/newsdiffs/commits/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                                    },
                                    "self": {
                                        "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                                    }
                                },
                                "hash": "8f5952f4dcffd7b311181d48eb0394b0cca21410"
                            }
                        ],
                        "type": "commit",
                        "message": "README.md edited online with Bitbucket",
                        "author": {
                            "type": "author",
                            "raw": "Max Bittker <max@getsentry.com>"
                        }
                    },
                    "name": "master"
                },
                "created": false,
                "forced": false,
                "closed": false
            }
        ]
    },
    "repository": {
        "links": {
            "html": {
                "href": "https://bitbucket.org/maxbittker/newsdiffs"
            },
            "avatar": {
                "href": "https://bitbucket.org/maxbittker/newsdiffs/avatar/32/"
            },
            "self": {
                "href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs"
            }
        },
        "full_name": "maxbittker/newsdiffs",
        "scm": "git",
        "uuid": "{c78dfb25-7882-4550-97b1-4e0d38f32859}",
        "type": "repository",
        "is_private": false,
        "owner": {
            "type": "user",
            "display_name": "Max Bittker",
            "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}",
            "username": "maxbittker",
            "links": {
                "html": {
                    "href": "https://bitbucket.org/maxbittker/"
                },
                "avatar": {
                    "href": "https://bitbucket.org/account/maxbittker/avatar/32/"
                },
                "self": {
                    "href": "https://api.bitbucket.org/2.0/users/maxbittker"
                }
            }
        },
        "name": "newsdiffs",
        "website": ""
    },
    "actor": {
        "type": "user",
        "display_name": "Max Bittker",
        "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}",
        "username": "maxbittker",
        "links": {
            "html": {
                "href": "https://bitbucket.org/maxbittker/"
            },
            "avatar": {
                "href": "https://bitbucket.org/account/maxbittker/avatar/32/"
            },
            "self": {
                "href": "https://api.bitbucket.org/2.0/users/maxbittker"
            }
        }
    }
}
"""
REPO = {
    "scm": "git",
    "website": "",
    "has_wiki": True,
    "description": "",
    "links": {
        "watchers": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/watchers"
        },
        "branches": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/refs/branches"
        },
        "tags": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/refs/tags"
        },
        "commits": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/commits"
        },
        "clone": [
            {
                "href": "https://laurynsentry@bitbucket.org/laurynsentry/helloworld.git",
                "name": "https",
            },
            {"href": "git@bitbucket.org:laurynsentry/helloworld.git", "name": "ssh"},
        ],
        "self": {"href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld"},
        "source": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/src"
        },
        "html": {"href": "https://bitbucket.org/laurynsentry/helloworld"},
        "avatar": {
            "href": "https://bytebucket.org/ravatar/%7B2a47ac11-098a-4054-8496-193754cae14b%7D?ts=default"
        },
        "hooks": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/hooks"
        },
        "forks": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/forks"
        },
        "downloads": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/downloads"
        },
        "issues": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/issues"
        },
        "pullrequests": {
            "href": "https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/pullrequests"
        },
    },
    "created_on": "2018-05-14T23:53:37.377674+00:00",
    "full_name": "laurynsentry/helloworld",
    "owner": {
        "username": "laurynsentry",
        "display_name": "Lauryn Brown",
        "account_id": "5a00066393915e620920e0ae",
        "links": {
            "self": {"href": "https://api.bitbucket.org/2.0/users/laurynsentry"},
            "html": {"href": "https://bitbucket.org/laurynsentry/"},
            "avatar": {"href": "https://bitbucket.org/account/laurynsentry/avatar/"},
        },
        "type": "user",
        "uuid": "{e50a27fe-0686-4d75-ba44-d27608bbb718}",
    },
    "has_issues": True,
    "slug": "helloworld",
    "is_private": False,
    "size": 221349,
    "name": "HelloWorld",
    "language": "",
    "fork_policy": "allow_forks",
    "uuid": "{2a47ac11-098a-4054-8496-193754cae14b}",
    "mainbranch": {"type": "branch", "name": "master"},
    "updated_on": "2018-05-30T18:21:08.780363+00:00",
    "type": "repository",
}
