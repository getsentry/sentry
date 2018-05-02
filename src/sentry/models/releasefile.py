"""
sentry.models.releasefile
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import models
from six.moves.urllib.parse import urlsplit, urlunsplit

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.utils.hashlib import sha1_text


class ReleaseFile(Model):
    r"""
    A ReleaseFile is an association between a Release and a File.

    The ident of the file should be sha1(name) or
    sha1(name '\x00\x00' dist.name) and must be unique per release.
    """
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    # DEPRECATED
    project_id = BoundedPositiveIntegerField(null=True)
    release = FlexibleForeignKey('sentry.Release')
    file = FlexibleForeignKey('sentry.File')
    ident = models.CharField(max_length=40)
    name = models.TextField()
    dist = FlexibleForeignKey('sentry.Distribution', null=True)

    __repr__ = sane_repr('release', 'ident')

    class Meta:
        unique_together = (('release', 'ident'), )
        app_label = 'sentry'
        db_table = 'sentry_releasefile'

    def save(self, *args, **kwargs):
        if not self.ident and self.name:
            dist = self.dist and self.dist.name or None
            self.ident = type(self).get_ident(self.name, dist)
        return super(ReleaseFile, self).save(*args, **kwargs)

    def update(self, *args, **kwargs):
        # If our name is changing, we must also change the ident
        if 'name' in kwargs and 'ident' not in kwargs:
            dist = kwargs.get('dist') or self.dist
            kwargs['ident'] = self.ident = type(self).get_ident(
                kwargs['name'], dist and dist.name or dist
            )
        return super(ReleaseFile, self).update(*args, **kwargs)

    @classmethod
    def get_ident(cls, name, dist=None):
        if dist is not None:
            return sha1_text(name + '\x00\x00' + dist).hexdigest()
        return sha1_text(name).hexdigest()

    @classmethod
    def normalize(cls, url):
        """Transforms a full absolute url into 2 or 4 generalized options

        * the original url as input
        * (optional) original url without querystring
        * the full url, but stripped of scheme and netloc
        * (optional) full url without scheme and netloc or querystring
        """
        # Always ignore the fragment
        scheme, netloc, path, query, _ = urlsplit(url)
        uri_relative = (None, None, path, query, None)
        uri_without_query = (scheme, netloc, path, None, None)
        uri_relative_without_query = (None, None, path, None, None)
        urls = [url]
        if query:
            urls.append(urlunsplit(uri_without_query))
        urls.append('~' + urlunsplit(uri_relative))
        if query:
            urls.append('~' + urlunsplit(uri_relative_without_query))
        return urls
