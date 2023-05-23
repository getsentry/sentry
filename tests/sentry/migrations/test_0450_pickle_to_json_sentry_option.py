from unittest import mock

from django.db import connection

import django_picklefield
from sentry.db.models.fields.picklefield import PickledObjectField
from sentry.models.options.option import Option
from sentry.testutils.cases import TestMigrations


def _get(k):
    with connection.cursor() as cur:
        cur.execute("select value from sentry_option where key = %s", [k])
        (ret,) = cur.fetchone()
        return ret


class BackfillTest(TestMigrations):
    migrate_from = "0449_pickle_to_json_authenticator"
    migrate_to = "0450_pickle_to_json_sentry_option"

    def setup_initial_state(self):
        with mock.patch.object(
            PickledObjectField,
            "get_db_prep_value",
            django_picklefield.PickledObjectField.get_db_prep_value,
        ):
            self.obj = Option.objects.create(
                key="hello-world",
                value={"hello": "there"},
            )

        # not json
        assert not _get(self.obj.key).startswith("{")

    def test(self):
        # json
        assert _get(self.obj.key).startswith("{")
