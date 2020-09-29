# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
from django.conf import settings
import social_auth.fields


class Migration(migrations.Migration):

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="UserSocialAuth",
            fields=[
                (
                    "id",
                    models.AutoField(
                        verbose_name="ID", serialize=False, auto_created=True, primary_key=True
                    ),
                ),
                ("provider", models.CharField(max_length=32)),
                ("uid", models.CharField(max_length=255)),
                ("extra_data", social_auth.fields.JSONField(default="{}")),
                (
                    "user",
                    models.ForeignKey(related_name="social_auth", to=settings.AUTH_USER_MODEL),
                ),
            ],
        ),
        migrations.AlterUniqueTogether(
            name="usersocialauth", unique_together=set([("provider", "uid", "user")])
        ),
    ]
