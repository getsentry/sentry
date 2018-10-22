from __future__ import absolute_import

__all__ = ['FeatureStore']


from sentry.utils.redis import get_cluster_from_options
from sentry.utils.services import Service


class FeatureStore(Service):
    def __init__(self, prefix='feat:', **options):
        self.cluster, options = get_cluster_from_options('SENTRY_FEATURE_STORE_OPTIONS', options)

    def _feat_key_name(self, name):
        return u'{}:name:{}'.format(self.prefix, name)

    def _org_key_name(self, organization_id):
        return u'{}:org:{}'.format(self.prefix, organization_id)

    def has_feature(self, organization_id, name):
        return self.conn.sismember(self._feat_key_name(name), organization_id)

    def for_feature(self, name):
        return self.conn.smembers(self._feat_key_name(name))

    def for_organization(self, organization_id):
        return self.conn.smembers(self._org_key_name(organization_id))

    def set(self, organization_id, name, is_active):
        pipe = self.conn.pipeline()
        if is_active:
            pipe.sadd(self._feat_key_name(name), organization_id)
            pipe.sadd(self._org_key_name(organization_id), name)
        else:
            pipe.srem(self._feat_key_name(name), organization_id)
            pipe.srem(self._org_key_name(organization_id), name)
        pipe.execute()
