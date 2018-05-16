from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.testutils.helpers import parse_queries


class ParseQuery(TestCase):
    def test_parse_query(self):
        result = parse_queries(
            [
                {u'sql': u'QUERY = u\'INSERT INTO "sentry_useremail" ("user_id", "email", "validation_hash", "date_hash_added", "is_verified") VALUES (%s, %s, %s, %s, %s)\' - PARAMS = (1, u\'admin@localhost\', u\'i0NlOcwzPKoObK8uNfg7mowTlOnvvlSI\', u\'2018-05-16 08:02:39.022342\', False)',
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'INSERT INTO "sentry_email" ("email", "date_added") VALUES (%s, %s)\' - PARAMS = (u\'admin@localhost\', u\'2018-05-16 08:02:39.023101\')',
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'UPDATE "sentry_useremail" SET "is_verified" = %s WHERE ("sentry_useremail"."user_id" = %s  AND "sentry_useremail"."email" = %s )\' - PARAMS = (True, 1, u\'admin@localhost\')',
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'DELETE * FROM "sentry_organization"\' - PARAMS = (u\'baz\', u\'baz\', 0, u\'2018-05-16 08:02:39.025899\', u\'member\', 1)',
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'INSERT INTO "sentry_organizationmember" ("organization_id", "user_id", "email", "role", "flags", "token", "date_added", "has_global_access", "type") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)\' - PARAMS = (2, 1, None, u\'owner\', 0, None, u\'2018-05-16 08:02:39.026919\', True, 50)',
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'UPDATE "sentry_projectoptions" SET "value" = %s WHERE ("sentry_projectoptions"."project_id" = %s  AND "sentry_projectoptions"."key" = %s )\' - PARAMS = (u\'gAJYIAAAADgwNmQxZjQ1NThkZjExZTg5ZWExOGM4NTkwMGNhNWI3cQEu\', 2, u\'sentry:relay-rev\')',
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'UPDATE "sentry_projectoptions" SET "value" = %s WHERE ("sentry_projectoptions"."project_id" = %s  AND "sentry_projectoptions"."key" = %s )\' - PARAMS = (u\'gAJjZGF0ZXRpbWUKZGF0ZXRpbWUKcQFVCgfiBRAIAicApBhjcHl0egpfVVRDCnECKVJxA4ZScQQu\', 2, u\'sentry:relay-rev-lastchange\')',
                 u'time': u'0.000'},
                {u'sql': u"QUERY = '\\n                insert or ignore into sentry_projectcounter\\n                  (project_id, value) values (%s, 0);\\n            ' - PARAMS = (2,)",
                 u'time': u'0.000'},
                {u'sql': u"QUERY = '\\n                select value from sentry_projectcounter\\n                 where project_id = %s\\n            ' - PARAMS = (2,)",
                 u'time': u'0.000'},
                {u'sql': u"QUERY = '\\n                    update sentry_projectcounter\\n                       set value = value + %s\\n                     where project_id = %s;\\n                ' - PARAMS = (1, 2)",
                 u'time': u'0.000'},
                {u'sql': u"QUERY = '\\n                    select changes();\\n                ' - PARAMS = ()",
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'INSERT INTO "sentry_groupedmessage" ("project_id", "logger", "level", "message", "view", "num_comments", "platform", "status", "times_seen", "last_seen", "first_seen", "first_release_id", "resolved_at", "active_at", "time_spent_total", "time_spent_count", "score", "is_public", "data", "short_id") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)\' - PARAMS = (2, u\'\', 40, u\'hello http://example.com\', u\'http://example.com\', 0, u\'javascript\', 0, 1, u\'2018-05-16 08:02:39\', u\'2018-05-16 08:02:39\', None, None, u\'2018-05-16 08:02:39\', 0, 0, 1526457759, False, u\'eJwVykEKg0AMheF9LjKuCk4dx16gFxDcSmgiHYgYOrHg7c0s//e+jrSHOQhWW3/84fJnCqAR3n2K45ByTi+oc7BL2fenW+INTzGvoT07GxIaeifoSEcnVkwaz7B8WeQAnaDWxw3kwCAZ\', 1)',
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'UPDATE "sentry_grouphash" SET "group_id" = %s WHERE ("sentry_grouphash"."id" IN (%s) AND NOT ("sentry_grouphash"."state" = %s  AND "sentry_grouphash"."state" IS NOT NULL))\' - PARAMS = (1, 1, 1)',
                 u'time': u'0.000'},
                {u'sql': u'QUERY = u\'UPDATE "sentry_userreport" SET "environment_id" = %s, "group_id" = %s WHERE ("sentry_userreport"."project_id" = %s  AND "sentry_userreport"."event_id" = %s )\' - PARAMS = (1, 1, 2, u\'45b41f6d313c442393aaa0293853d70f\')',
                 u'time': u'0.000'}]
        )

        assert result == {
            'sentry_email': 1,
            'sentry_groupedmessage': 1,
            'sentry_grouphash': 1,
            'sentry_organization': 1,
            'sentry_organizationmember': 1,
            'sentry_projectcounter': 2,
            'sentry_projectoptions': 2,
            'sentry_useremail': 2,
            'sentry_userreport': 1
        }
