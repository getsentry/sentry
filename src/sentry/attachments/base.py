"""
sentry.attachments.base
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import zlib


class CachedAttachment(object):
    def __init__(self, name=None, content_type=None, type=None, data=None, load=None):
        if data is None and load is None:
            raise AttributeError('Missing attachment data')

        self.name = name
        self.content_type = content_type
        self.type = type or 'event.attachment'

        self._data = data
        self._load = load

    @classmethod
    def from_upload(cls, file, **kwargs):
        return CachedAttachment(
            name=file.name,
            content_type=file.content_type,
            data=file.read(),
            **kwargs
        )

    @property
    def data(self):
        if self._data is None and self._load is not None:
            self._data = self._load()

        return self._data

    def meta(self):
        return {
            'name': self.name,
            'content_type': self.content_type,
            'type': self.type,
        }


class BaseAttachmentCache(object):
    def __init__(self, inner, appendix='a', **options):
        self.appendix = appendix
        self.inner = inner

    def make_key(self, key):
        return '{}:{}'.format(key, self.appendix)

    def set(self, key, attachments, timeout=None):
        key = self.make_key(key)
        for index, attachment in enumerate(attachments):
            compressed = zlib.compress(attachment.data)
            self.inner.set('{}:{}'.format(key, index), compressed, timeout, raw=True)

        meta = [attachment.meta() for attachment in attachments]
        self.inner.set(key, meta, timeout, raw=False)

    def get(self, key):
        key = self.make_key(key)
        result = self.inner.get(key, raw=False)
        if result is not None:
            result = [
                CachedAttachment(
                    load=lambda index=index: zlib.decompress(
                        self.inner.get('{}:{}'.format(key, index), raw=True)),
                    **attachment
                )
                for index, attachment in enumerate(result)
            ]
        return result

    def delete(self, key):
        key = self.make_key(key)
        attachments = self.inner.get(key, raw=False)
        if attachments is None:
            return

        for index in range(0, len(attachments)):
            self.inner.delete('{}:{}'.format(key, index))
        self.inner.delete(key)
