# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.utils.timezone
import sentry.db.models.fields.gzippeddict


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Node',
            fields=[
                ('id', models.CharField(max_length=40, serialize=False, primary_key=True)),
                ('data', sentry.db.models.fields.gzippeddict.GzippedDictField()),
                ('timestamp', models.DateTimeField(default=django.utils.timezone.now, db_index=True)),
            ],
        ),
    ]
