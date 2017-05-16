"""
sentry.models.release
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text


class EnvironmentProject(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    environment = FlexibleForeignKey('sentry.Environment')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_environmentproject'
        unique_together = (('project', 'environment'),)


class Environment(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField()
    projects = models.ManyToManyField('sentry.Project', through=EnvironmentProject)
    project_id = BoundedPositiveIntegerField(null=True)
    name = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_environment'
        unique_together = (
            ('project_id', 'name'),
            ('organization_id', 'name'),
        )

    __repr__ = sane_repr('organization_id', 'name')

    @classmethod
    def get_cache_key(cls, organization_id, name):
        return 'env:2:%s:%s' % (organization_id, md5_text(name).hexdigest())

    @classmethod
    def get_or_create(cls, project, name):
        name = name or ''

        cache_key = cls.get_cache_key(project.organization_id, name)

        env = cache.get(cache_key)
        if env is None:
            try:
                with transaction.atomic():
                    env = cls.objects.create(
                        name=name,
                        organization_id=project.organization_id,
                    )
            except IntegrityError:
                env = cls.objects.get(
                    name=name,
                    organization_id=project.organization_id,
                )

            cache.set(cache_key, env, 3600)

        env.add_project(project)

        return env

    def add_project(self, project):
        try:
            with transaction.atomic():
                EnvironmentProject.objects.create(project=project, environment=self)
        except IntegrityError:
            pass
