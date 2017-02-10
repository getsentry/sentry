"""
sentry.models.release
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import re

from django.db import models, IntegrityError, transaction
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text


_sha1_re = re.compile(r'^[a-f0-9]{40}$')


class ReleaseProject(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    release = FlexibleForeignKey('sentry.Release')
    new_groups = BoundedPositiveIntegerField(null=True, default=0)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release_project'
        unique_together = (('project', 'release'),)


class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.
    """
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    projects = models.ManyToManyField('sentry.Project', related_name='releases',
                                      through=ReleaseProject)
    project_id = BoundedPositiveIntegerField(null=True)
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
        unique_together = (('organization', 'version'),)

    __repr__ = sane_repr('organization', 'version')

    @classmethod
    def get_cache_key(cls, organization_id, version):
        return 'release:3:%s:%s' % (organization_id, md5_text(version).hexdigest())

    @classmethod
    def get(cls, project, version):
        cache_key = cls.get_cache_key(project.organization_id, version)

        release = cache.get(cache_key)
        if release is None:
            try:
                release = cls.objects.get(
                    organization_id=project.organization_id,
                    projects=project,
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
        cache_key = cls.get_cache_key(project.organization_id, version)

        release = cache.get(cache_key)
        if release in (None, -1):
            # TODO(dcramer): if the cache result is -1 we could attempt a
            # default create here instead of default get
            project_version = ('%s-%s' % (project.slug, version))[:64]
            releases = list(cls.objects.filter(
                organization_id=project.organization_id,
                version__in=[version, project_version],
                projects=project
            ))
            if releases:
                try:
                    release = [r for r in releases if r.version == project_version][0]
                except IndexError:
                    release = releases[0]
            else:
                try:
                    with transaction.atomic():
                        release = cls.objects.create(
                            organization_id=project.organization_id,
                            version=version,
                            date_added=date_added
                        )
                except IntegrityError:
                    release = cls.objects.get(
                        organization_id=project.organization_id,
                        version=version
                    )
                release.add_project(project)

            # TODO(dcramer): upon creating a new release, check if it should be
            # the new "latest release" for this project
            cache.set(cache_key, release, 3600)

        return release

    @classmethod
    def merge(cls, to_release, from_releases):
        # The following models reference release:
        # ReleaseCommit.release
        # ReleaseEnvironment.release_id
        # ReleaseProject.release
        # GroupRelease.release_id
        # GroupResolution.release
        # Group.first_release
        # ReleaseFile.release

        from sentry.models import (
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject,
            Group, GroupRelease, GroupResolution
        )

        model_list = (
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject,
            GroupRelease, GroupResolution
        )
        for release in from_releases:
            for model in model_list:
                if hasattr(model, 'release'):
                    update_kwargs = {'release': to_release}
                else:
                    update_kwargs = {'release_id': to_release.id}
                try:
                    with transaction.atomic():
                        model.objects.filter(
                            release_id=release.id
                        ).update(**update_kwargs)
                except IntegrityError:
                    for item in model.objects.filter(release_id=release.id):
                        try:
                            with transaction.atomic():
                                model.objects.filter(
                                    id=item.id
                                ).update(**update_kwargs)
                        except IntegrityError:
                            item.delete()

            Group.objects.filter(
                first_release=release
            ).update(first_release=to_release)

            release.delete()

    @property
    def short_version(self):
        if _sha1_re.match(self.version):
            return self.version[:12]
        return self.version

    def add_project(self, project):
        try:
            with transaction.atomic():
                ReleaseProject.objects.create(project=project, release=self)
        except IntegrityError:
            pass
