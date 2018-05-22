from __future__ import absolute_import

from collections import OrderedDict

# TODO(LB): Just copy and paste is very likely wrong!

PUSH_EVENT_EXAMPLE = b"""{
    "push": {
        "changes": [
            {
                "links": {
                    "html": {
                        "href": "https://bitbucket.org/sentryuser/newsdiffs/branches/compare/e0e377d186e4f0e937bdb487a23384fe002df649..8f5952f4dcffd7b311181d48eb0394b0cca21410"
                    },
                    "commits": {
                        "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commits?include=e0e377d186e4f0e937bdb487a23384fe002df649&exclude=8f5952f4dcffd7b311181d48eb0394b0cca21410"
                    },
                    "diff": {
                        "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/diff/e0e377d186e4f0e937bdb487a23384fe002df649..8f5952f4dcffd7b311181d48eb0394b0cca21410"
                    }
                },
                "commits": [
                    {
                        "links": {
                            "approve": {
                                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649/approve"
                            },
                            "statuses": {
                                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649/statuses"
                            },
                            "comments": {
                                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649/comments"
                            },
                            "self": {
                                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649"
                            },
                            "patch": {
                                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/patch/e0e377d186e4f0e937bdb487a23384fe002df649"
                            },
                            "html": {
                                "href": "https://bitbucket.org/sentryuser/newsdiffs/commits/e0e377d186e4f0e937bdb487a23384fe002df649"
                            },
                            "diff": {
                                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/diff/e0e377d186e4f0e937bdb487a23384fe002df649"
                            }
                        },
                        "date": "2017-05-24T01:05:47+00:00",
                        "hash": "e0e377d186e4f0e937bdb487a23384fe002df649",
                        "parents": [
                            {
                                "type": "commit",
                                "links": {
                                    "html": {
                                        "href": "https://bitbucket.org/sentryuser/newsdiffs/commits/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                                    },
                                    "self": {
                                        "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/8f5952f4dcffd7b311181d48eb0394b0cca21410"
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
                                "display_name": "Sentry User",
                                "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}",
                                "username": "sentryuser",
                                "links": {
                                    "html": {
                                        "href": "https://bitbucket.org/sentryuser/"
                                    },
                                    "avatar": {
                                        "href": "https://bitbucket.org/account/sentryuser/avatar/32/"
                                    },
                                    "self": {
                                        "href": "https://api.bitbucket.org/2.0/users/sentryuser"
                                    }
                                }
                            },
                            "raw": "Sentry User <max@getsentry.com>"
                        }
                    }
                ],
                "old": {
                    "type": "branch",
                    "links": {
                        "html": {
                            "href": "https://bitbucket.org/sentryuser/newsdiffs/branch/master"
                        },
                        "commits": {
                            "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commits/master"
                        },
                        "self": {
                            "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/refs/branches/master"
                        }
                    },
                    "target": {
                        "links": {
                            "html": {
                                "href": "https://bitbucket.org/sentryuser/newsdiffs/commits/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                            },
                            "self": {
                                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                            }
                        },
                        "date": "2017-05-19T22:53:22+00:00",
                        "hash": "8f5952f4dcffd7b311181d48eb0394b0cca21410",
                        "parents": [
                            {
                                "type": "commit",
                                "links": {
                                    "html": {
                                        "href": "https://bitbucket.org/sentryuser/newsdiffs/commits/1cdfa36e62e615cdc73a1d5fcff1c706965b186d"
                                    },
                                    "self": {
                                        "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/1cdfa36e62e615cdc73a1d5fcff1c706965b186d"
                                    }
                                },
                                "hash": "1cdfa36e62e615cdc73a1d5fcff1c706965b186d"
                            }
                        ],
                        "type": "commit",
                        "message": "README.md edited online with Bitbucket",
                        "author": {
                            "type": "author",
                            "raw": "Sentry User <max@getsentry.com>"
                        }
                    },
                    "name": "master"
                },
                "truncated": false,
                "new": {
                    "type": "branch",
                    "links": {
                        "html": {
                            "href": "https://bitbucket.org/sentryuser/newsdiffs/branch/master"
                        },
                        "commits": {
                            "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commits/master"
                        },
                        "self": {
                            "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/refs/branches/master"
                        }
                    },
                    "target": {
                        "links": {
                            "html": {
                                "href": "https://bitbucket.org/sentryuser/newsdiffs/commits/e0e377d186e4f0e937bdb487a23384fe002df649"
                            },
                            "self": {
                                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e0e377d186e4f0e937bdb487a23384fe002df649"
                            }
                        },
                        "date": "2017-05-24T01:05:47+00:00",
                        "hash": "e0e377d186e4f0e937bdb487a23384fe002df649",
                        "parents": [
                            {
                                "type": "commit",
                                "links": {
                                    "html": {
                                        "href": "https://bitbucket.org/sentryuser/newsdiffs/commits/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                                    },
                                    "self": {
                                        "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/8f5952f4dcffd7b311181d48eb0394b0cca21410"
                                    }
                                },
                                "hash": "8f5952f4dcffd7b311181d48eb0394b0cca21410"
                            }
                        ],
                        "type": "commit",
                        "message": "README.md edited online with Bitbucket",
                        "author": {
                            "type": "author",
                            "raw": "Sentry User <max@getsentry.com>"
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
                "href": "https://bitbucket.org/sentryuser/newsdiffs"
            },
            "avatar": {
                "href": "https://bitbucket.org/sentryuser/newsdiffs/avatar/32/"
            },
            "self": {
                "href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs"
            }
        },
        "full_name": "sentryuser/newsdiffs",
        "scm": "git",
        "uuid": "{c78dfb25-7882-4550-97b1-4e0d38f32859}",
        "type": "repository",
        "is_private": false,
        "owner": {
            "type": "user",
            "display_name": "Sentry User",
            "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}",
            "username": "sentryuser",
            "links": {
                "html": {
                    "href": "https://bitbucket.org/sentryuser/"
                },
                "avatar": {
                    "href": "https://bitbucket.org/account/sentryuser/avatar/32/"
                },
                "self": {
                    "href": "https://api.bitbucket.org/2.0/users/sentryuser"
                }
            }
        },
        "name": "newsdiffs",
        "website": ""
    },
    "actor": {
        "type": "user",
        "display_name": "Sentry User",
        "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}",
        "username": "sentryuser",
        "links": {
            "html": {
                "href": "https://bitbucket.org/sentryuser/"
            },
            "avatar": {
                "href": "https://bitbucket.org/account/sentryuser/avatar/32/"
            },
            "self": {
                "href": "https://api.bitbucket.org/2.0/users/sentryuser"
            }
        }
    }
}
"""

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
      "repository": {"links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs"}, "avatar": {"href": "https://bitbucket.org/sentryuser/newsdiffs/avatar/32/"}}, "type": "repository", "name": "newsdiffs", "full_name": "sentryuser/newsdiffs", "uuid": "{c78dfb25-7882-4550-97b1-4e0d38f32859}"}, "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "comments": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/comments"}, "patch": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/patch/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "diff": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/diff/e18e4e72de0d824edfbe0d73efe34cbd0d01d301"}, "approve": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/approve"}, "statuses": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/statuses"}}, "author": {"raw": "Sentry User <max@getsentry.com>", "type": "author", "user": {"username": "sentryuser", "display_name": "Sentry User", "type": "user", "uuid": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}", "links": {"self": {"href": "https://api.bitbucket.org/2.0/users/sentryuser"}, "html": {"href": "https://bitbucket.org/sentryuser/"}, "avatar": {"href": "https://bitbucket.org/account/sentryuser/avatar/32/"}}}}, "parents": [{"hash": "26de9b63d09aa9c787e899f149c672023e292925", "type": "commit", "links": {"self": {"href": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commit/26de9b63d09aa9c787e899f149c672023e292925"}, "html": {"href": "https://bitbucket.org/sentryuser/newsdiffs/commits/26de9b63d09aa9c787e899f149c672023e292925"}}}], "date": "2017-05-16T23:21:40+00:00", "message": "README.md edited online with Bitbucket", "type": "commit"}],
  "next": "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301?page=2"
}
"""

COMMIT_DIFF_PATCH = b"""diff --git a/README.md b/README.md
index 89821ce..9e09a8a 100644
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-A twitter bot to when words are said by the NYT for the first time.
\ No newline at end of file
+A twitter bot to when words are said by the NYT for the first time.sdfsdf
\ No newline at end of file"""

# -----------------
# Get an issue
GET_ISSUE = {
    u'pagelen': 20,
    u'values': [OrderedDict([
        (u'priority', u'major'),
        (u'kind', u'bug'),
        (u'repository', OrderedDict([
            (u'links', OrderedDict([
                (u'self', OrderedDict(
                    [(u'href', u'https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld')])),
                (u'html', OrderedDict(
                    [(u'href', u'https://bitbucket.org/laurynsentry/helloworld')])),
                (u'avatar', OrderedDict([(u'href', u'https://bitbucket.org/laurynsentry/helloworld/avatar/32/')]))])
             ),
            (u'type', u'repository'),
            (u'name', u'HelloWorld'),
            (u'full_name', u'laurynsentry/helloworld'),
            (u'uuid', u'{2a47ac11-098a-4054-8496-193754cae14b}')])
         ),
        (u'links', OrderedDict([
            (u'attachments', OrderedDict(
                [(u'href', u'https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/issues/1/attachments')])),
            (u'self', OrderedDict(
                [(u'href', u'https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/issues/1')])),
            (u'watch', OrderedDict(
                [(u'href', u'https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/issues/1/watch')])),
            (u'comments', OrderedDict(
                [(u'href', u'https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/issues/1/comments')])),
            (u'html', OrderedDict(
                [(u'href', u'https://bitbucket.org/laurynsentry/helloworld/issues/1/hello-world-issue')])),
            (u'vote', OrderedDict([(u'href', u'https://api.bitbucket.org/2.0/repositories/laurynsentry/helloworld/issues/1/vote')]))])
         ),
        (u'reporter', OrderedDict([
            (u'username', u'laurynsentry'),
            (u'display_name', u'Lauryn Brown'),
            (u'type', u'user'),
            (u'uuid', u'{e50a27fe-0686-4d75-ba44-d27608bbb718}'),
            (u'links', OrderedDict([(u'self', OrderedDict([(u'href', u'https://api.bitbucket.org/2.0/users/laurynsentry')])),
                                    (u'html', OrderedDict(
                                        [(u'href', u'https://bitbucket.org/laurynsentry/')])),
                                    (u'avatar', OrderedDict([(u'href', u'https://bitbucket.org/account/laurynsentry/avatar/32/')]))]))])
         ),
        (u'title', u'Hello World Issue'),
        (u'component', None),
        (u'votes', 0),
        (u'watches', 1),
        (u'content', OrderedDict(
            [(u'raw', u''), (u'markup', u'markdown'), (u'html', u''), (u'type', u'rendered')])),
        (u'assignee',
         OrderedDict([(u'username',
                       u'laurynsentry'),
                      (u'display_name',
                       u'Lauryn Brown'),
                      (u'type',
                       u'user'),
                      (u'uuid',
                       u'{e50a27fe-0686-4d75-ba44-d27608bbb718}'),
                      (u'links',
                       OrderedDict([(u'self',
                                     OrderedDict([(u'href',
                                                   u'https://api.bitbucket.org/2.0/users/laurynsentry')])),
                                    (u'html',
                                     OrderedDict([(u'href',
                                                   u'https://bitbucket.org/laurynsentry/')])),
                                    (u'avatar',
                                     OrderedDict([(u'href',
                                                   u'https://bitbucket.org/account/laurynsentry/avatar/32/')]))]))])),
        (u'state', u'new'),
        (u'version', None),
        (u'edited_on', None),
        (u'created_on', u'2018-05-21T21:34:53.339059+00:00'),
        (u'milestone', None),
        (u'updated_on', u'2018-05-21T21:34:53.339059+00:00'),
        (u'type', u'issue'),
        (u'id', 1)])],
    u'page': 1,
    u'size': 1
}
