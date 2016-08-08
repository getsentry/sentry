from __future__ import absolute_import

from django.core import signing
from django.core.urlresolvers import reverse

from sentry import options
from sentry.models import User
from sentry.utils.http import absolute_uri
from sentry.utils.numbers import base36_encode, base36_decode


def get_signer():
    return signing.TimestampSigner(salt='sentry-link-signature')


def generate_signed_link(user, viewname, args=None, kwargs=None):
    """This returns an absolute URL where the given user is signed in for
    the given viewname with args and kwargs.  This returns a redirect link
    that if followed sends the user to another URL which carries another
    signature that is valid for that URL only.  The user can also be a user
    ID.
    """
    if hasattr(user, 'is_authenticated'):
        if not user.is_authenticated():
            raise RuntimeError('Need an authenticated user to sign a link.')
        user_id = user.id
    else:
        user_id = user

    path = reverse(viewname, args=args, kwargs=kwargs)
    item = '%s|%s|%s' % (options.get('system.url-prefix'), path,
                         base36_encode(user_id))
    signature = ':'.join(get_signer().sign(item).rsplit(':', 2)[1:])

    return '%s?_=%s:%s' % (
        absolute_uri(path),
        base36_encode(user_id),
        signature,
    )


def process_signature(request, max_age=60 * 60 * 24 * 10):
    """Given a request object this validates the signature from the
    current request and returns the user.
    """
    sig = request.GET.get('_') or request.POST.get('_sentry_request_signature')
    if not sig or sig.count(':') < 2:
        return None

    signed_data = '%s|%s|%s' % (request.build_absolute_uri('/').rstrip('/'),
                                request.path, sig)
    try:
        data = get_signer().unsign(signed_data, max_age=max_age)
    except signing.BadSignature:
        return None

    _, signed_path, user_id = data.rsplit('|', 2)
    if signed_path != request.path:
        return None

    try:
        return User.objects.get(pk=base36_decode(user_id))
    except (ValueError, User.DoesNotExist):
        return None
