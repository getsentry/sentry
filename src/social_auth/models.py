import base64
import time
import re

from datetime import datetime, timedelta
from django.conf import settings
from django.db import models
from django.db.models.loading import get_model
from openid.association import Association as OIDAssociation

from .fields import JSONField
from .utils import setting


AUTH_USER_MODEL = settings.AUTH_USER_MODEL

UID_LENGTH = setting('SOCIAL_AUTH_UID_LENGTH', 255)
NONCE_SERVER_URL_LENGTH = setting('SOCIAL_AUTH_NONCE_SERVER_URL_LENGTH', 255)
ASSOCIATION_SERVER_URL_LENGTH = setting(
    'SOCIAL_AUTH_ASSOCIATION_SERVER_URL_LENGTH',
    255
)
ASSOCIATION_HANDLE_LENGTH = setting(
    'SOCIAL_AUTH_ASSOCIATION_HANDLE_LENGTH',
    255
)

CLEAN_USERNAME_REGEX = re.compile(r'[^\w.@+-_]+', re.UNICODE)


class UserSocialAuth(models.Model):
    """Social Auth association model"""
    user = models.ForeignKey(AUTH_USER_MODEL, related_name='social_auth')
    provider = models.CharField(max_length=32)
    uid = models.CharField(max_length=UID_LENGTH)
    extra_data = JSONField(default='{}')

    class Meta:
        """Meta data"""
        unique_together = ('provider', 'uid')
        app_label = 'social_auth'

    def __unicode__(self):
        """Return associated user unicode representation"""
        return u'%s - %s' % (unicode(self.user), self.provider.title())

    def get_backend(self):
        # Make import here to avoid recursive imports :-/
        from social_auth.backends import get_backends
        return get_backends().get(self.provider)

    @property
    def tokens(self):
        """Return access_token stored in extra_data or None"""
        backend = self.get_backend()
        if backend:
            return backend.AUTH_BACKEND.tokens(self)
        else:
            return {}

    def revoke_token(self, drop_token=True):
        """Attempts to revoke permissions for provider."""
        if 'access_token' in self.tokens:
            success = self.get_backend().revoke_token(
                self.tokens['access_token'],
                self.uid
            )
            if success and drop_token:
                self.extra_data.pop('access_token', None)
                self.save()

    def refresh_token(self):
        refresh_token = self.extra_data.get('refresh_token')
        if refresh_token:
            backend = self.get_backend()
            if hasattr(backend, 'refresh_token'):
                response = backend.refresh_token(refresh_token)
                new_access_token = response.get('access_token')
                # We have not got a new access token, so don't lose the
                # existing one.
                if not new_access_token:
                    return
                self.extra_data['access_token'] = new_access_token
                # New refresh token might be given.
                new_refresh_token = response.get('refresh_token')
                if new_refresh_token:
                    self.extra_data['refresh_token'] = new_refresh_token
                self.save()

    def expiration_datetime(self):
        """Return provider session live seconds. Returns a timedelta ready to
        use with session.set_expiry().

        If provider returns a timestamp instead of session seconds to live, the
        timedelta is inferred from current time (using UTC timezone). None is
        returned if there's no value stored or it's invalid.
        """
        if self.extra_data and 'expires' in self.extra_data:
            try:
                expires = int(self.extra_data['expires'])
            except (ValueError, TypeError):
                return None

            now = datetime.utcnow()

            # Detect if expires is a timestamp
            if expires > time.mktime(now.timetuple()):
                # expires is a datetime
                return datetime.fromtimestamp(expires) - now
            else:
                # expires is a timedelta
                return timedelta(seconds=expires)

    @classmethod
    def clean_username(cls, value):
        return CLEAN_USERNAME_REGEX.sub('', value)

    @classmethod
    def allowed_to_disconnect(cls, user, backend_name, association_id=None):
        if association_id is not None:
            qs = cls.objects.exclude(id=association_id)
        else:
            qs = cls.objects.exclude(provider=backend_name)
        qs = qs.filter(user=user)

        if hasattr(user, 'has_usable_password'):
            valid_password = user.has_usable_password()
        else:
            valid_password = True

        return valid_password or qs.count() > 0

    @classmethod
    def user_username(cls, user):
        if hasattr(user, 'USERNAME_FIELD'):
            # Django 1.5 custom user model, 'username' is just for internal
            # use, doesn't imply that the model should have an username field
            field_name = user.USERNAME_FIELD
        else:
            field_name = 'username'
        return getattr(user, field_name)

    @classmethod
    def username_field(cls, values):
        user_model = cls.user_model()
        if hasattr(user_model, 'USERNAME_FIELD'):
            # Django 1.5 custom user model, 'username' is just for internal
            # use, doesn't imply that the model should have an username field
            values[user_model.USERNAME_FIELD] = values.pop('username')
        return values

    @classmethod
    def simple_user_exists(cls, *args, **kwargs):
        """
        Return True/False if a User instance exists with the given arguments.
        Arguments are directly passed to filter() manager method.
        TODO: consider how to ensure case-insensitive email matching
        """
        kwargs = cls.username_field(kwargs)
        # Use count() > 0 since mongoengine doesn't support .exists(),
        # Check issue #728
        return cls.user_model().objects.filter(*args, **kwargs).count() > 0

    @classmethod
    def create_user(cls, *args, **kwargs):
        kwargs = cls.username_field(kwargs)
        return cls.user_model().objects.create_user(*args, **kwargs)

    @classmethod
    def get_user(cls, pk):
        try:
            return cls.user_model().objects.get(pk=pk)
        except cls.user_model().DoesNotExist:
            return None

    @classmethod
    def get_user_by_email(cls, email):
        """Case insensitive search"""
        # Do case-insensitive match, since real-world email address is
        # case-insensitive.
        return cls.user_model().objects.get(email__iexact=email)

    @classmethod
    def resolve_user_or_id(cls, user_or_id):
        if isinstance(user_or_id, cls.user_model()):
            return user_or_id
        return cls.user_model().objects.get(pk=user_or_id)

    @classmethod
    def get_social_auth_for_user(cls, user):
        return user.social_auth.all()

    @classmethod
    def create_social_auth(cls, user, uid, provider):
        if not isinstance(uid, basestring):
            uid = str(uid)
        return cls.objects.create(user=user, uid=uid, provider=provider)

    @classmethod
    def store_association(cls, server_url, association):
        from social_auth.models import Association
        args = {'server_url': server_url, 'handle': association.handle}
        try:
            assoc = Association.objects.get(**args)
        except Association.DoesNotExist:
            assoc = Association(**args)
        assoc.secret = base64.encodestring(association.secret)
        assoc.issued = association.issued
        assoc.lifetime = association.lifetime
        assoc.assoc_type = association.assoc_type
        assoc.save()

    @classmethod
    def remove_association(cls, server_url, handle):
        from social_auth.models import Association
        assocs = list(Association.objects.filter(
            server_url=server_url, handle=handle))
        assocs_exist = len(assocs) > 0
        for assoc in assocs:
            assoc.delete()
        return assocs_exist

    @classmethod
    def get_oid_associations(cls, server_url, handle=None):
        from social_auth.models import Association
        args = {'server_url': server_url}
        if handle is not None:
            args['handle'] = handle

        return sorted([
            (assoc.id, OIDAssociation(
                assoc.handle,
                base64.decodestring(assoc.secret),
                assoc.issued,
                assoc.lifetime,
                assoc.assoc_type))
            for assoc in Association.objects.filter(**args)
        ], key=lambda x: x[1].issued, reverse=True)

    @classmethod
    def delete_associations(cls, ids_to_delete):
        from social_auth.models import Association
        Association.objects.filter(pk__in=ids_to_delete).delete()

    @classmethod
    def use_nonce(cls, server_url, timestamp, salt):
        from social_auth.models import Nonce
        return Nonce.objects.get_or_create(server_url=server_url,
                                           timestamp=timestamp,
                                           salt=salt)[1]

    @classmethod
    def get_social_auth(cls, provider, uid):
        try:
            return cls.objects.select_related('user').get(provider=provider,
                                                          uid=uid)
        except UserSocialAuth.DoesNotExist:
            return None

    @classmethod
    def username_max_length(cls):
        return cls._field_length('USERNAME_FIELD', 'username')

    @classmethod
    def email_max_length(cls):
        return cls._field_length('EMAIL_FIELD', 'email')

    @classmethod
    def _field_length(self, setting_name, default_name):
        model = UserSocialAuth.user_model()
        field_name = getattr(model, setting_name, default_name)
        return model._meta.get_field(field_name).max_length

    @classmethod
    def user_model(cls):
        return get_model(*AUTH_USER_MODEL.split('.'))


class Nonce(models.Model):
    """One use numbers"""
    server_url = models.CharField(max_length=NONCE_SERVER_URL_LENGTH)
    timestamp = models.IntegerField(db_index=True)
    salt = models.CharField(max_length=40)

    class Meta:
        app_label = 'social_auth'
        unique_together = ('server_url', 'timestamp', 'salt')

    def __unicode__(self):
        """Unicode representation"""
        return self.server_url


class Association(models.Model):
    """OpenId account association"""
    server_url = models.CharField(max_length=ASSOCIATION_SERVER_URL_LENGTH)
    handle = models.CharField(max_length=ASSOCIATION_HANDLE_LENGTH)
    secret = models.CharField(max_length=255)  # Stored base64 encoded
    issued = models.IntegerField(db_index=True)
    lifetime = models.IntegerField()
    assoc_type = models.CharField(max_length=64)

    class Meta:
        app_label = 'social_auth'
        unique_together = ('server_url', 'handle')

    def __unicode__(self):
        """Unicode representation"""
        return '%s %s' % (self.handle, self.issued)
