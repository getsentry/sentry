from __future__ import absolute_import


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
