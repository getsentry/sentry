"""
sentry.models.release
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.app import locks
from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text
from sentry.utils.retries import TimedRetryPolicy


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
    project_id = BoundedPositiveIntegerField()
    name = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_environment'
        unique_together = (('project_id', 'name'),)

    __repr__ = sane_repr('project_id', 'name')

    @classmethod
    def get_cache_key(cls, project_id, name):
        return 'env:1:%s:%s' % (project_id, md5_text(name).hexdigest())

    @classmethod
    def get_lock_key(cls, organization_id, name):
        return 'environment:%s:%s' % (organization_id, md5_text(name).hexdigest())

    @classmethod
    def get_or_create(cls, project, name):
        name = name or ''

        cache_key = cls.get_cache_key(project.id, name)

        env = cache.get(cache_key)
        if env is None:
            try:
                env = cls.objects.get(
                    projects=project,
                    organization_id=project.organization_id,
                    name=name,
                )
            except cls.DoesNotExist:
                env = cls.objects.filter(
                    organization_id=project.organization_id,
                    name=name,
                ).order_by('date_added').first()
                if not env:
                    lock_key = cls.get_lock_key(project.organization_id, name)
                    lock = locks.get(lock_key, duration=5)
                    with TimedRetryPolicy(10)(lock.acquire):
                        try:
                            env = cls.objects.get(
                                organization_id=project.organization_id,
                                name=name,
                            )
                        except cls.DoesNotExist:
                            env = cls.objects.create(
                                project_id=project.id,
                                name=name,
                                organization_id=project.organization_id
                            )
                env.add_project(project)

            cache.set(cache_key, env, 3600)

        return env

    def add_project(self, project):
        try:
            with transaction.atomic():
                EnvironmentProject.objects.create(project=project, environment=self)
        except IntegrityError:
            pass
