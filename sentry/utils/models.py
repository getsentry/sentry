"""
sentry.utils.models
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import base64
import logging

from django.db import models, router
from django.db.models import signals
from django.db.models.expressions import ExpressionNode

from sentry.utils.compat import pickle
from sentry.utils.db import resolve_expression_node

logger = logging.getLogger(__name__)


def merge_account(from_user, to_user):
    # TODO: we could discover relations automatically and make this useful
    from sentry.models import GroupBookmark, Project, ProjectKey, Team, TeamMember, \
      UserOption

    for obj in ProjectKey.objects.filter(user=from_user):
        obj.update(user=to_user)
    for obj in TeamMember.objects.filter(user=from_user):
        obj.update(user=to_user)
    for obj in Project.objects.filter(owner=from_user):
        obj.update(owner=to_user)
    for obj in Team.objects.filter(owner=from_user):
        obj.update(owner=to_user)
    for obj in GroupBookmark.objects.filter(user=from_user):
        obj.update(user=to_user)
    for obj in UserOption.objects.filter(user=from_user):
        obj.update(user=to_user)


def update(self, using=None, **kwargs):
    """
    Updates specified attributes on the current instance.
    """
    assert self.pk, "Cannot update an instance that has not yet been created."

    using = using or router.db_for_write(self.__class__, instance=self)

    for field in self._meta.fields:
        if getattr(field, 'auto_now', False) and field.name not in kwargs:
            kwargs[field.name] = field.pre_save(self, False)

    affected = self.__class__._base_manager.using(using).filter(pk=self.pk).update(**kwargs)
    for k, v in kwargs.iteritems():
        if isinstance(v, ExpressionNode):
            v = resolve_expression_node(self, v)
        setattr(self, k, v)
    if affected == 1:
        signals.post_save.send(sender=self.__class__, instance=self, created=False)
        return True
    elif affected == 0:
        raise self.DoesNotExist("Cannot update an instance that is not in the database.")
    elif affected < 0:
        raise ValueError("Somehow we have updated a negative amount of rows, you seem to have a problem with your db backend.")
    else:
        raise ValueError("Somehow we have updated multiple rows, and you are now royally fucked.")

update.alters_data = True


class Model(models.Model):
    class Meta:
        abstract = True

    update = update


class GzippedDictField(models.TextField):
    """
    Slightly different from a JSONField in the sense that the default
    value is a dictionary.
    """
    __metaclass__ = models.SubfieldBase

    def to_python(self, value):
        if isinstance(value, basestring) and value:
            try:
                value = pickle.loads(base64.b64decode(value).decode('zlib'))
            except Exception, e:
                logger.exception(e)
                return {}
        elif not value:
            return {}
        return value

    def get_prep_value(self, value):
        if value is None:
            return
        return base64.b64encode(pickle.dumps(value).encode('zlib'))

    def value_to_string(self, obj):
        value = self._get_val_from_obj(obj)
        return self.get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.TextField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)
