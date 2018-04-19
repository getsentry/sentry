from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (ProjectDSymFile, VersionDSymFile, DSymApp, DSYM_PLATFORMS_REVERSE)


@register(ProjectDSymFile)
class DSymFileSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': six.text_type(obj.id),
            'uuid': obj.debug_id[:36],
            'debugId': obj.debug_id,
            'cpuName': obj.cpu_name,
            'objectName': obj.object_name,
            'symbolType': obj.dsym_type,
            'headers': obj.file.headers,
            'size': obj.file.size,
            'sha1': obj.file.checksum,
            'dateCreated': obj.file.timestamp,
        }
        return d


@register(VersionDSymFile)
class VersionDSymFileSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': six.text_type(obj.id),
            'version': obj.version,
            'build': obj.build,
            'dateAdded': obj.date_added,
            'dsymAppId': obj.dsym_app_id,
            'dsym': serialize(obj.dsym_file)
        }
        return d


@register(DSymApp)
class DSymAppSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': six.text_type(obj.id),
            'iconUrl': obj.data.get('icon_url', None),
            'appId': six.text_type(obj.app_id),
            'name': obj.data.get('name', None),
            'platform': DSYM_PLATFORMS_REVERSE.get(obj.platform) or 'unknown',
            # XXX: this should be renamed.  It's currently only used in
            # the not yet merged itunes connect plugin (ios, tvos etc.)
            'platforms': ', '.join(obj.data.get('platforms', [])),
            'lastSync': obj.last_synced,
        }
        return d
