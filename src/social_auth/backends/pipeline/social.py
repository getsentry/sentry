from __future__ import absolute_import

from django.db import IntegrityError

from social_auth.models import UserSocialAuth


def social_auth_user(backend, uid, user, *args, **kwargs):
    """
    Return UserSocialAuth details.
    """
    social_user = UserSocialAuth.get_social_auth(backend.name, uid, user)
    return {
        'social_user': social_user,
        'user': user,
        'new_association': False
    }


def associate_user(backend, user, uid, social_user=None, *args, **kwargs):
    """Associate user social account with user instance."""
    if social_user or not user:
        return None

    try:
        social = UserSocialAuth.create_social_auth(user, uid, backend.name)
    except IntegrityError:
        # Protect for possible race condition, those bastard with FTL
        # clicking capabilities, check issue #131:
        #   https://github.com/omab/django-social-auth/issues/131
        return social_auth_user(backend, uid, user, social_user=social_user,
                                *args, **kwargs)
    else:
        return {'social_user': social,
                'user': social.user,
                'new_association': True}


def load_extra_data(backend, details, response, uid, user, social_user=None,
                    *args, **kwargs):
    """Load extra data from provider and store it on current UserSocialAuth
    extra_data field.
    """
    social_user = (social_user or
                   UserSocialAuth.get_social_auth(backend.name, uid, user))
    if social_user:
        extra_data = backend.extra_data(user, uid, response, details)
        if kwargs.get('original_email') and 'email' not in extra_data:
            extra_data['email'] = kwargs.get('original_email')
        if extra_data and social_user.extra_data != extra_data:
            if social_user.extra_data:
                social_user.extra_data.update(extra_data)
            else:
                social_user.extra_data = extra_data
            social_user.save()
        return {'social_user': social_user}
