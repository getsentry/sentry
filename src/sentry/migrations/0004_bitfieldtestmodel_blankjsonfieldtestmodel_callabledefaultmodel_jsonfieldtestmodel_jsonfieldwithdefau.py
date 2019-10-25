# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.conf import settings
from django.db import migrations, models
import bitfield.models
import sentry.models
import sentry.db.models.fields.jsonfield


def is_test_db():
    return settings.DATABASES.get("default", {}).get("NAME", "").startswith("test_")


class Migration(migrations.Migration):
    """
    This is a hack to get these test models to work when we run the tests using
    migrations. We don't need to run this in dev or prod, and so we just check that the
    database name starts with `test_`.
    """

    is_dangerous = True

    dependencies = [("sentry", "0003_auto_20191022_0122")]

    if is_test_db():
        operations = [
            migrations.CreateModel(
                name="BitFieldTestModel",
                fields=[
                    (
                        "id",
                        models.AutoField(
                            verbose_name="ID", serialize=False, auto_created=True, primary_key=True
                        ),
                    ),
                    (
                        "flags",
                        bitfield.models.BitField(
                            (b"FLAG_0", b"FLAG_1", b"FLAG_2", b"FLAG_3"),
                            default=3,
                            db_column=b"another_name",
                        ),
                    ),
                ],
            ),
            migrations.CreateModel(
                name="BlankJSONFieldTestModel",
                fields=[
                    (
                        "id",
                        models.AutoField(
                            verbose_name="ID", serialize=False, auto_created=True, primary_key=True
                        ),
                    ),
                    ("null_json", sentry.db.models.fields.jsonfield.JSONField(null=True)),
                    (
                        "blank_json",
                        sentry.db.models.fields.jsonfield.JSONField(default=dict, blank=True),
                    ),
                ],
            ),
            migrations.CreateModel(
                name="CallableDefaultModel",
                fields=[
                    (
                        "id",
                        models.AutoField(
                            verbose_name="ID", serialize=False, auto_created=True, primary_key=True
                        ),
                    ),
                    ("json", sentry.db.models.fields.jsonfield.JSONField()),
                ],
            ),
            migrations.CreateModel(
                name="JSONFieldTestModel",
                fields=[
                    (
                        "id",
                        models.AutoField(
                            verbose_name="ID", serialize=False, auto_created=True, primary_key=True
                        ),
                    ),
                    (
                        "json",
                        sentry.db.models.fields.jsonfield.JSONField(
                            null=True, verbose_name=b"test", blank=True
                        ),
                    ),
                ],
            ),
            migrations.CreateModel(
                name="JSONFieldWithDefaultTestModel",
                fields=[
                    (
                        "id",
                        models.AutoField(
                            verbose_name="ID", serialize=False, auto_created=True, primary_key=True
                        ),
                    ),
                    (
                        "json",
                        sentry.db.models.fields.jsonfield.JSONField(
                            default={b"sukasuka": b"YAAAAAZ"}
                        ),
                    ),
                ],
            ),
        ]
