"""
sentry.models.releasefile
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import models
from hashlib import sha1

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class ReleaseFile(Model):
    """
    A ReleaseFile is an association between a Release and a File.

    The ident of the file should be sha1(name) and must be unique per release.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    release = FlexibleForeignKey('sentry.Release')
    file = FlexibleForeignKey('sentry.File')
    ident = models.CharField(max_length=40)
    name = models.TextField()

    __repr__ = sane_repr('release', 'ident')

    class Meta:
        unique_together = (('release', 'ident'),)
        app_label = 'sentry'
        db_table = 'sentry_releasefile'

    def save(self, *args, **kwargs):
        if not self.ident and self.name:
            self.ident = type(self).get_ident(self.name)
        return super(ReleaseFile, self).save(*args, **kwargs)

    @classmethod
    def get_ident(cls, name):
        return sha1(name.encode('utf-8')).hexdigest()
