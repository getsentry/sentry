"""
sentry.models.release
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import re

from django.db import models
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

_sha1_re = re.compile(r'^[a-f0-9]{40}$')


class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    version = models.CharField(max_length=64)
    # ref might be the branch name being released
    ref = models.CharField(max_length=64, null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_started = models.DateTimeField(null=True, blank=True)
    date_released = models.DateTimeField(null=True, blank=True)
    # arbitrary data recorded with the release
    data = JSONField(default={})
    new_groups = BoundedPositiveIntegerField(default=0)
    # generally the release manager, or the person initiating the process
    owner = FlexibleForeignKey('sentry.User', null=True, blank=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release'
        unique_together = (('project', 'version'),)

    __repr__ = sane_repr('project_id', 'version')

    @classmethod
    def get_cache_key(cls, project_id, version):
        return 'release:2:%s:%s' % (project_id, md5_text(version).hexdigest())

    @classmethod
    def get(cls, project, version):
        cache_key = cls.get_cache_key(project.id, version)

        release = cache.get(cache_key)
        if release is None:
            try:
                release = cls.objects.get(
                    project=project,
                    version=version,
                )
            except cls.DoesNotExist:
                release = -1
            cache.set(cache_key, release, 300)

        if release == -1:
            return

        return release

    @classmethod
    def get_or_create(cls, project, version, date_added):
        cache_key = cls.get_cache_key(project.id, version)

        release = cache.get(cache_key)
        if release in (None, -1):
            # TODO(dcramer): if the cache result is -1 we could attempt a
            # default create here instead of default get
            release = cls.objects.get_or_create(
                project=project,
                version=version,
                defaults={
                    'date_added': date_added,
                },
            )[0]
            # TODO(dcramer): upon creating a new release, check if it should be
            # the new "latest release" for this project
            cache.set(cache_key, release, 3600)

        return release

    @property
    def short_version(self):
        if _sha1_re.match(self.version):
            return self.version[:12]
        return self.version
