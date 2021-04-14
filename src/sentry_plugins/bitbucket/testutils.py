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

COMPARE_COMMITS_EXAMPLE = b"""{
"pagelen": 30,
 "values":
     [{"hash": "e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
      "repository": {"links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs"}, "html": {"href": "https://bitbucket.org/maxbittker/newsdiffs"}, "avatar": {"href": "https://bitbucket.org/maxbittker/newsdiffs/avatar/32/"}}, "type": "repository", "name": "newsdiffs", "full_name": "maxbittker/newsdiffs", "uuid": "{c78dfb25-7882-4550-97b1-4e0d38f32859}"}, "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "comments": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/comments"}, "patch": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/patch/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "html": {"href": "https://bitbucket.org/maxbittker/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "diff": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/diff/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "approve": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/approve"}, "statuses": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/statuses"}},
       "author": {
            "raw": "Max Bittker <max@getsentry.com>",
            "type": "author"
        },
        "parents": [{"hash": "26de9b63d09aa9c787e899f149c672023e292925", "type": "commit", "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/26de9b63d09aa9c787e899f149c672023e292925"}, "html": {"href": "https://bitbucket.org/maxbittker/newsdiffs/commits/26de9b63d09aa9c787e899f149c672023e292925"}}}], "date": "2017-05-16T23:21:40+00:00", "message": "README.md edited online with Bitbucket", "type": "commit"}],
  "next": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301?page=2"
}
"""

GET_LAST_COMMITS_EXAMPLE = b"""{
"pagelen": 30,
 "values":
     [{"hash": "e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
      "repository": {"links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs"}, "html": {"href": "https://bitbucket.org/maxbittker/newsdiffs"}, "avatar": {"href": "https://bitbucket.org/maxbittker/newsdiffs/avatar/32/"}}, "type": "repository", "name": "newsdiffs", "full_name": "maxbittker/newsdiffs", "uuid": "{c78dfb25-7882-4550-97b1-4e0d38f32859}"}, "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "comments": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/comments"}, "patch": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/patch/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "html": {"href": "https://bitbucket.org/maxbittker/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "diff": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/diff/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "approve": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/approve"}, "statuses": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/statuses"}}, "author": {"raw": "Max Bittker <max@getsentry.com>", "type": "author", "user": {"username": "maxbittker", "display_name": "Max Bittker", "type": "user", "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}", "links": {"self": {"href": "https://api.bitbucket.org/2.0/users/maxbittker"}, "html": {"href": "https://bitbucket.org/maxbittker/"}, "avatar": {"href": "https://bitbucket.org/account/maxbittker/avatar/32/"}}}}, "parents": [{"hash": "26de9b63d09aa9c787e899f149c672023e292925", "type": "commit", "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commit/26de9b63d09aa9c787e899f149c672023e292925"}, "html": {"href": "https://bitbucket.org/maxbittker/newsdiffs/commits/26de9b63d09aa9c787e899f149c672023e292925"}}}], "date": "2017-05-16T23:21:40+00:00", "message": "README.md edited online with Bitbucket", "type": "commit"}],
  "next": "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301?page=2"
}
"""

COMMIT_DIFF_PATCH = b"""diff --git a/README.md b/README.md
index 89821ce..9e09a8a 100644
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-A twitter bot to when words are said by the NYT for the first time.
\\ No newline at end of file
+A twitter bot to when words are said by the NYT for the first time.sdfsdf
\\ No newline at end of file"""
