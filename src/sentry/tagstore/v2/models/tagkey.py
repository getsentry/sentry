"""
sentry.tagstore.v2.models.tagkey
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

from django.db import models, router, connections, transaction, IntegrityError
from django.utils.translation import ugettext_lazy as _

from sentry.tagstore import TagKeyStatus
from sentry.tagstore.query import TagStoreManager
from sentry.constants import MAX_TAG_KEY_LENGTH
from sentry.db.models import (Model, BoundedPositiveIntegerField, BoundedBigIntegerField, sane_repr)
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text


class TagKey(Model):
    """
    Stores references to available filters keys.
    """
    __core__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    environment_id = BoundedBigIntegerField()
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    values_seen = BoundedPositiveIntegerField(default=0)
    status = BoundedPositiveIntegerField(
        choices=(
            (TagKeyStatus.VISIBLE, _('Visible')),
            (TagKeyStatus.PENDING_DELETION, _('Pending Deletion')),
            (TagKeyStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
        ),
        default=TagKeyStatus.VISIBLE
    )

    objects = TagStoreManager()

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'environment_id', 'key'), )

    __repr__ = sane_repr('project_id', 'environment_id', 'key')

    def delete(self):
        using = router.db_for_read(TagKey)
        cursor = connections[using].cursor()
        cursor.execute(
            """
            DELETE FROM tagstore_tagkey
            WHERE project_id = %s
              AND id = %s
        """, [self.project_id, self.id]
        )

    def get_label(self):
        from sentry import tagstore

        return tagstore.get_tag_key_label(self.key)

    def get_audit_log_data(self):
        return {
            'key': self.key,
        }

    @classmethod
    def get_cache_key(cls, project_id, environment_id, key):
        return 'tagkey:1:%s:%s:%s' % (project_id, environment_id, md5_text(key).hexdigest())

    @classmethod
    def get_or_create(cls, project_id, environment_id, key, **kwargs):
        cache_key = cls.get_cache_key(project_id, environment_id, key)

        rv = cache.get(cache_key)
        created = False
        if rv is None:
            rv, created = cls.objects.get_or_create(
                project_id=project_id,
                environment_id=environment_id,
                key=key,
                **kwargs
            )
            cache.set(cache_key, rv, 3600)

        return rv, created

    @classmethod
    def get_or_create_bulk(cls, project_id, environment_id, keys):
        # Attempt to create a bunch of models in one big batch with as few
        # queries and cache calls as possible.
        # In best case, this is all done in 1 cache get.
        # In ideal case, we'll do 3 queries total instead of N.
        # Absolute worst case, we still just do O(n) queries, but this should be rare.
        key_to_model = {key: None for key in keys}
        remaining_keys = set(keys)

        # First attempt to hit from cache, which in theory is the hot case
        cache_key_to_key = {cls.get_cache_key(project_id, environment_id, key): key for key in keys}
        cache_key_to_models = cache.get_many(cache_key_to_key.keys())
        for model in cache_key_to_models.values():
            key_to_model[model.key] = model
            remaining_keys.remove(model.key)

        if not remaining_keys:
            # 100% cache hit on all items, good work team
            return key_to_model

        # If we have some misses, we want to first check if
        # all of the misses actually exist in the database
        # already in one bulk query.
        to_cache = {}
        for model in cls.objects.filter(
            project_id=project_id,
            environment_id=environment_id,
            key__in=remaining_keys,
        ):
            key_to_model[model.key] = to_cache[cls.get_cache_key(
                project_id, environment_id, model.key)] = model
            remaining_keys.remove(model.key)

        # If we have found them all, cache all these misses
        # and return all the hits.
        if not remaining_keys:
            cache.set_many(to_cache, 3600)
            return key_to_model

        # At this point, we need to create all of our keys, since they
        # don't exist in cache or the database.

        # First attempt to create them all in one bulk query
        try:
            with transaction.atomic():
                cls.objects.bulk_create([
                    cls(
                        project_id=project_id,
                        environment_id=environment_id,
                        key=key,
                    )
                    for key in remaining_keys
                ])
        except IntegrityError:
            pass
        else:
            # If we succeed, the shitty part is we need one
            # more query to get back the actual rows with their ids.
            for model in cls.objects.filter(
                project_id=project_id,
                environment_id=environment_id,
                key__in=remaining_keys
            ):
                key_to_model[model.key] = to_cache[cls.get_cache_key(
                    project_id, environment_id, model.key)] = model
                remaining_keys.remove(model.key)

            cache.set_many(to_cache, 3600)

            # Not clear if this could actually happen, but if it does,
            # guard ourselves against returning bad data.
            if not remaining_keys:
                return key_to_model

        # Fall back to just doing it manually
        # This case will only ever happen in a race condition.
        for key in remaining_keys:
            key_to_model[key] = cls.get_or_create(project_id, environment_id, key)[0]

        return key_to_model
