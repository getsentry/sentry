from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.testutils.helpers import parse_queries


class ParseQuery(TestCase):
    def test_parse_postgres_queries(self):
        result = parse_queries(
            [
                {u"sql": u'SAVEPOINT "s47890194282880_x49"', u"time": u"0.000"},
                {u"sql": u'RELEASE SAVEPOINT "s47890194282880_x49"', u"time": u"0.000"},
                {
                    u"sql": u'SELECT "sentry_rawevent"."id", "sentry_rawevent"."project_id", "sentry_rawevent"."event_id", "sentry_rawevent"."datetime", "sentry_rawevent"."data" FROM "sentry_rawevent" WHERE ("sentry_rawevent"."event_id" = \'1fba9e314001443b93285dc4411f1593\'  AND "sentry_rawevent"."project_id" = 864 )',
                    u"time": u"0.000",
                },
                {
                    u"sql": u'SELECT "sentry_reprocessingreport"."id", "sentry_reprocessingreport"."project_id", "sentry_reprocessingreport"."event_id", "sentry_reprocessingreport"."datetime" FROM "sentry_reprocessingreport" WHERE ("sentry_reprocessingreport"."event_id" = \'1fba9e314001443b93285dc4411f1593\'  AND "sentry_reprocessingreport"."project_id" = 864 )',
                    u"time": u"0.001",
                },
                {u"sql": u'SAVEPOINT "s47890194282880_x50"', u"time": u"0.000"},
                {
                    u"sql": u'INSERT INTO "sentry_eventuser" ("project_id", "hash", "ident", "email", "username", "name", "ip_address", "date_added") VALUES (864, \'f528764d624db129b32c21fbca0cb8d6\', NULL, NULL, NULL, NULL, \'127.0.0.1\', \'2018-05-22 09:12:12.357888+00:00\') RETURNING "sentry_eventuser"."id"',
                    u"time": u"0.000",
                },
                {u"sql": u'ROLLBACK TO SAVEPOINT "s47890194282880_x50"', u"time": u"0.000"},
                {
                    u"sql": u'SELECT "sentry_eventuser"."id", "sentry_eventuser"."project_id", "sentry_eventuser"."hash", "sentry_eventuser"."ident", "sentry_eventuser"."email", "sentry_eventuser"."username", "sentry_eventuser"."name", "sentry_eventuser"."ip_address", "sentry_eventuser"."date_added" FROM "sentry_eventuser" WHERE ("sentry_eventuser"."project_id" = 864  AND "sentry_eventuser"."hash" = \'f528764d624db129b32c21fbca0cb8d6\' )',
                    u"time": u"0.000",
                },
                {
                    u"sql": u'SELECT "sentry_grouphash"."id", "sentry_grouphash"."project_id", "sentry_grouphash"."hash", "sentry_grouphash"."group_id", "sentry_grouphash"."group_tombstone_id", "sentry_grouphash"."state" FROM "sentry_grouphash" WHERE ("sentry_grouphash"."project_id" = 864  AND "sentry_grouphash"."hash" = \'5d41402abc4b2a76b9719d911017c592\' )',
                    u"time": u"0.000",
                },
                {
                    u"sql": u'SELECT "sentry_groupedmessage"."id", "sentry_groupedmessage"."project_id", "sentry_groupedmessage"."logger", "sentry_groupedmessage"."level", "sentry_groupedmessage"."message", "sentry_groupedmessage"."view", "sentry_groupedmessage"."num_comments", "sentry_groupedmessage"."platform", "sentry_groupedmessage"."status", "sentry_groupedmessage"."times_seen", "sentry_groupedmessage"."last_seen", "sentry_groupedmessage"."first_seen", "sentry_groupedmessage"."first_release_id", "sentry_groupedmessage"."resolved_at", "sentry_groupedmessage"."active_at", "sentry_groupedmessage"."time_spent_total", "sentry_groupedmessage"."time_spent_count", "sentry_groupedmessage"."score", "sentry_groupedmessage"."is_public", "sentry_groupedmessage"."data", "sentry_groupedmessage"."short_id" FROM "sentry_groupedmessage" WHERE "sentry_groupedmessage"."id" = 662 ',
                    u"time": u"0.000",
                },
                {
                    u"sql": u'SELECT "sentry_project"."id", "sentry_project"."slug", "sentry_project"."name", "sentry_project"."forced_color", "sentry_project"."organization_id", "sentry_project"."public", "sentry_project"."date_added", "sentry_project"."status", "sentry_project"."first_event", "sentry_project"."flags", "sentry_project"."platform" FROM "sentry_project" WHERE "sentry_project"."id" = 864 ',
                    u"time": u"0.000",
                },
                {
                    u"sql": u'UPDATE "sentry_groupedmessage" SET "times_seen" = "sentry_groupedmessage"."times_seen" + 1, "score" = 1526980332, "data" = \'eJwVyksKhEAMRdF5NlKORKv89QbcgOBUgokopOlgRcHddxze905BWsMUBLMtJ6983EwBNMJYt7H7DFVKEfIU7FH2Pbkl3vAS82re58uGhIbeLRSknRM7TF7ew7yzyA90gJzLP+FOIA0=\', "last_seen" = \'2018-05-22 09:12:12+00:00\' WHERE "sentry_groupedmessage"."id" = 662 ',
                    u"time": u"0.001",
                },
                {u"sql": u'SAVEPOINT "s47890194282880_x51"', u"time": u"0.000"},
                {
                    u"sql": u'INSERT INTO "sentry_environmentproject" ("project_id", "environment_id", "is_hidden") VALUES (864, 165, NULL) RETURNING "sentry_environmentproject"."id"',
                    u"time": u"0.000",
                },
                {u"sql": u'ROLLBACK TO SAVEPOINT "s47890194282880_x51"', u"time": u"0.000"},
                {
                    u"sql": u'UPDATE "sentry_userreport" SET "environment_id" = 165, "group_id" = 662 WHERE ("sentry_userreport"."project_id" = 864  AND "sentry_userreport"."event_id" = \'1fba9e314001443b93285dc4411f1593\' )',
                    u"time": u"0.000",
                },
                {u"sql": u'SAVEPOINT "s47890194282880_x52"', u"time": u"0.000"},
                {
                    u"sql": u'UPDATE "nodestore_node" SET "timestamp" = \'2018-05-22 09:12:12.374085+00:00\', "data" = \'eJxtU8Fu2zAMvesrfIsLbI4lS7KTnYoBW4qu7SFdcgxUm3G0OLEgq127ov8+UnHTSxHACMn3KOo9Km0cZ8uJ8/0fqMOEOcGuKi3ZsJwMcAz+JbPHAH5rahiy3wN4hBQsbZxElnUb0zQehgGzChNclFmOP46xZsOnTW4QblpAREl9KqQdzqkZW+2g63rmeB758By8wQLnBOaCBtt42G6ewA+2P1KpYFfi84EXIThCyEimCR99RwmN52BtPp3Cszm4DrK6P2C+pD47MA12J1zF0s7xGX1FzlYkwNfLFs9BoTgzq5v+n+06M1VZnqRre2z6v0Nye5/oTHxL1ndrLS+SS4f91/BwbcNUFWVW6CS9Xtzf/PqSdHYPyU+o9/1F8n3n+wNMRUX6qTzPSpEszdZ4O7LwSMGMIVXqHu/4HGhEEd0QZEcfYxVjjfGHRKJkt0g7mgOJLEjz92ErSsyi1g8eEyeHc2pScNYiczk5z0QllLqNHU4DU6pAOvK39tiCdx4NoKwk1QoS/fU1aWBrHruQvL1RSTMz+khR+bFyzZ4SVTx9hsy6syj2xpKLMmetJtTHvSRnK9q3HP/GFRhvKAu22rh+CGsbdotoJyZlvKWHGuwTNART7AdXQs+qvCgiH7zvo/NS0/Qy7kMwbUzFZZC4DMtJB09Ai6RyNpIo4Cw4hR6l73umis/3TElCqog8be388aS8ws20bn5+SIQrI64fstPtVmfrqFjF4mjdiHAK39HJHnyHOcI0Lmvaoq1jOjlbSkUceWhJyyjvHl42luTR+LBmyCEJXhz11bRmo5UUKqodIJjGBHqlWpNzmnYm2NBFSsXa+Jaz/zqNSI8=\' WHERE "nodestore_node"."id" = \'u9iv1Ih4RDqz5GtlwX3+TA==\' ',
                    u"time": u"0.000",
                },
                {u"sql": u'SAVEPOINT "s47890194282880_x53"', u"time": u"0.000"},
                {
                    u"sql": u'INSERT INTO "nodestore_node" ("id", "data", "timestamp") VALUES (\'u9iv1Ih4RDqz5GtlwX3+TA==\', \'eJxtU8Fu2zAMvesrfIsLbI4lS7KTnYoBW4qu7SFdcgxUm3G0OLEgq127ov8+UnHTSxHACMn3KOo9Km0cZ8uJ8/0fqMOEOcGuKi3ZsJwMcAz+JbPHAH5rahiy3wN4hBQsbZxElnUb0zQehgGzChNclFmOP46xZsOnTW4QblpAREl9KqQdzqkZW+2g63rmeB758By8wQLnBOaCBtt42G6ewA+2P1KpYFfi84EXIThCyEimCR99RwmN52BtPp3Cszm4DrK6P2C+pD47MA12J1zF0s7xGX1FzlYkwNfLFs9BoTgzq5v+n+06M1VZnqRre2z6v0Nye5/oTHxL1ndrLS+SS4f91/BwbcNUFWVW6CS9Xtzf/PqSdHYPyU+o9/1F8n3n+wNMRUX6qTzPSpEszdZ4O7LwSMGMIVXqHu/4HGhEEd0QZEcfYxVjjfGHRKJkt0g7mgOJLEjz92ErSsyi1g8eEyeHc2pScNYiczk5z0QllLqNHU4DU6pAOvK39tiCdx4NoKwk1QoS/fU1aWBrHruQvL1RSTMz+khR+bFyzZ4SVTx9hsy6syj2xpKLMmetJtTHvSRnK9q3HP/GFRhvKAu22rh+CGsbdotoJyZlvKWHGuwTNART7AdXQs+qvCgiH7zvo/NS0/Qy7kMwbUzFZZC4DMtJB09Ai6RyNpIo4Cw4hR6l73umis/3TElCqog8be388aS8ws20bn5+SIQrI64fstPtVmfrqFjF4mjdiHAK39HJHnyHOcI0Lmvaoq1jOjlbSkUceWhJyyjvHl42luTR+LBmyCEJXhz11bRmo5UUKqodIJjGBHqlWpNzmnYm2NBFSsXa+Jaz/zqNSI8=\', \'2018-05-22 09:12:12.374085+00:00\')',
                    u"time": u"0.000",
                },
                {u"sql": u'RELEASE SAVEPOINT "s47890194282880_x53"', u"time": u"0.000"},
                {u"sql": u'RELEASE SAVEPOINT "s47890194282880_x52"', u"time": u"0.000"},
                {u"sql": u'SAVEPOINT "s47890194282880_x54"', u"time": u"0.000"},
                {u"sql": u'RELEASE SAVEPOINT "s47890194282880_x54"', u"time": u"0.000"},
                {
                    u"sql": u'SELECT "sentry_groupedmessage"."id", "sentry_groupedmessage"."project_id", "sentry_groupedmessage"."logger", "sentry_groupedmessage"."level", "sentry_groupedmessage"."message", "sentry_groupedmessage"."view", "sentry_groupedmessage"."num_comments", "sentry_groupedmessage"."platform", "sentry_groupedmessage"."status", "sentry_groupedmessage"."times_seen", "sentry_groupedmessage"."last_seen", "sentry_groupedmessage"."first_seen", "sentry_groupedmessage"."first_release_id", "sentry_groupedmessage"."resolved_at", "sentry_groupedmessage"."active_at", "sentry_groupedmessage"."time_spent_total", "sentry_groupedmessage"."time_spent_count", "sentry_groupedmessage"."score", "sentry_groupedmessage"."is_public", "sentry_groupedmessage"."data", "sentry_groupedmessage"."short_id" FROM "sentry_groupedmessage" WHERE "sentry_groupedmessage"."id" = 662 ',
                    u"time": u"0.001",
                },
                {
                    u"sql": u'SELECT "sentry_groupsnooze"."id", "sentry_groupsnooze"."group_id", "sentry_groupsnooze"."until", "sentry_groupsnooze"."count", "sentry_groupsnooze"."window", "sentry_groupsnooze"."user_count", "sentry_groupsnooze"."user_window", "sentry_groupsnooze"."state", "sentry_groupsnooze"."actor_id" FROM "sentry_groupsnooze" WHERE "sentry_groupsnooze"."group_id" = 662 ',
                    u"time": u"0.000",
                },
                {
                    u"sql": u'SELECT "sentry_grouprulestatus"."id", "sentry_grouprulestatus"."project_id", "sentry_grouprulestatus"."rule_id", "sentry_grouprulestatus"."group_id", "sentry_grouprulestatus"."status", "sentry_grouprulestatus"."date_added", "sentry_grouprulestatus"."last_active" FROM "sentry_grouprulestatus" WHERE ("sentry_grouprulestatus"."group_id" = 662  AND "sentry_grouprulestatus"."rule_id" = 935 )',
                    u"time": u"0.000",
                },
                {u"sql": u'SAVEPOINT "s47890194282880_x55"', u"time": u"0.000"},
                {u"sql": u'RELEASE SAVEPOINT "s47890194282880_x55"', u"time": u"0.000"},
            ]
        )

        assert result == {
            "nodestore_node": 2,
            "sentry_environmentproject": 1,
            "sentry_eventuser": 1,
            "sentry_groupedmessage": 1,
            "sentry_userreport": 1,
        }
