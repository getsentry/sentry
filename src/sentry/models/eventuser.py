from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from operator import or_
from six.moves import reduce

from sentry.db.models import BoundedPositiveIntegerField, Model, sane_repr
from sentry.utils.hashlib import md5_text
from sentry.constants import MAX_EMAIL_FIELD_LENGTH

KEYWORD_MAP = {
    'id': 'ident',
    'email': 'email',
    'username': 'username',
    'ip': 'ip_address',
}


class EventUser(Model):
    __core__ = False

    project_id = BoundedPositiveIntegerField(db_index=True)
    hash = models.CharField(max_length=32)
    ident = models.CharField(max_length=128, null=True)
    email = models.EmailField(null=True, max_length=MAX_EMAIL_FIELD_LENGTH)
    username = models.CharField(max_length=128, null=True)
    name = models.CharField(max_length=128, null=True)
    ip_address = models.GenericIPAddressField(null=True)
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventuser'
        unique_together = (('project_id', 'ident'), ('project_id', 'hash'))
        index_together = (
            ('project_id', 'email'),
            ('project_id', 'username'),
            ('project_id', 'ip_address'),
        )

    __repr__ = sane_repr('project_id', 'ident', 'email',
                         'username', 'ip_address')

    @classmethod
    def attr_from_keyword(cls, keyword):
        return KEYWORD_MAP[keyword]

    @classmethod
    def for_tags(cls, project_id, values):
        """
        Finds matching EventUser objects from a list of tag values.

        Return a dictionary of {tag_value: event_user}.
        """
        hashes = [md5_text(v.split(':', 1)[-1]).hexdigest() for v in values]
        return {e.tag_value: e for e in cls.objects.filter(
            project_id=project_id,
            hash__in=hashes,
        )}

    def save(self, *args, **kwargs):
        assert self.ident or self.username or self.email or self.ip_address, \
            'No identifying value found for user'
        if not self.hash:
            self.set_hash()
        super(EventUser, self).save(*args, **kwargs)

    def set_hash(self):
        self.hash = self.build_hash()

    def build_hash(self):
        value = self.ident or self.username or self.email or self.ip_address
        if not value:
            return None
        return md5_text(value).hexdigest()

    @property
    def tag_value(self):
        """
        Return the identifier used with tags to link this user.
        """
        if self.ident:
            return u'id:{}'.format(self.ident)
        if self.email:
            return u'email:{}'.format(self.email)
        if self.username:
            return u'username:{}'.format(self.username)
        if self.ip_address:
            return u'ip:{}'.format(self.ip_address)

    def get_label(self):
        return self.email or self.username or self.ident or self.ip_address

    def get_display_name(self):
        return self.name or self.email or self.username

    def find_similar_users(self, user):
        from sentry.models import (OrganizationMemberTeam, Project)
        # limit to only teams user has opted into
        project_ids = list(
            Project.objects.filter(
                teams__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=user,
                    organizationmember__organization__project=self.project_id,
                    is_active=True,
                ).values('team'),
            ).values_list('id', flat=True)[:1000]
        )
        if not project_ids:
            return type(self).objects.none()

        filters = []
        if self.email:
            filters.append(models.Q(email=self.email))
        if self.ip_address:
            filters.append(models.Q(ip_address=self.ip_address))
        if not filters:
            return type(self).objects.none()
        return type(self).objects.exclude(id=self.id).filter(
            reduce(or_, filters),
            project_id__in=project_ids,
        )
