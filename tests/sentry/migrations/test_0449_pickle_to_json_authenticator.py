from unittest import mock

from django.db import connection

import django_picklefield
from sentry.db.models.fields.picklefield import PickledObjectField
from sentry.models.authenticator import Authenticator
from sentry.testutils.cases import TestMigrations


def _get_config(obj_id):
    with connection.cursor() as cur:
        cur.execute("select config from auth_authenticator where id = %s", [obj_id])
        (config,) = cur.fetchone()
        return config


class BackfillTest(TestMigrations):
    migrate_from = "0448_add_expected_time_config_to_cron_checkin"
    migrate_to = "0449_pickle_to_json_authenticator"

    def setup_initial_state(self):
        with mock.patch.object(
            PickledObjectField,
            "get_db_prep_value",
            django_picklefield.PickledObjectField.get_db_prep_value,
        ):
            self.obj = Authenticator.objects.create(
                type=3,  # u2f
                user=self.create_user(),
                config={
                    "devices": [
                        {
                            "binding": {
                                "publicKey": "aowekroawker",
                                "keyHandle": "devicekeyhandle",
                                "appId": "https://testserver/auth/2fa/u2fappid.json",
                            },
                            "name": "Amused Beetle",
                            "ts": 1512505334,
                        },
                        {
                            "binding": {
                                "publicKey": "publickey",
                                "keyHandle": "aowerkoweraowerkkro",
                                "appId": "https://testserver/auth/2fa/u2fappid.json",
                            },
                            "name": "Sentry",
                            "ts": 1512505334,
                        },
                    ]
                },
            )

        # not json
        assert not _get_config(self.obj.id).startswith("{")

    def test(self):
        # json
        assert _get_config(self.obj.id).startswith("{")
