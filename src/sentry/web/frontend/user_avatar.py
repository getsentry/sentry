from __future__ import absolute_import

from django.http import (
    HttpResponse, HttpResponseBadRequest, HttpResponseNotFound,
    HttpResponseRedirect,
)
from django.views.generic import View

from sentry.models import UserAvatar
from sentry.web.frontend.generic import FOREVER_CACHE


def useravatar_response(avatar, size=None):
    if avatar.avatar_type == 0:
        return HttpResponse(
            avatar.get_letter_avatar(size=size),
            content_type='image/svg+xml',
        )
    elif avatar.avatar_type == 1:
        if size:
            return HttpResponse(
                avatar.get_cached_photo(size),
                content_type='image/png',
            )
        else:
            return HttpResponse(
                avatar.file.getfile(),
                content_type='image/png',
            )
    elif avatar.avatar_type == 2:
        return HttpResponseRedirect(avatar.get_gravatar_url(size=size))


class UserAvatarPhotoView(View):
    def get(self, request, *args, **kwargs):
        avatar_id = kwargs['avatar_id']
        try:
            avatar = UserAvatar.objects.get(ident=avatar_id)
        except UserAvatar.DoesNotExist:
            return HttpResponseNotFound()

        size = request.GET.get('s')
        if size:
            try:
                size = int(size)
            except ValueError:
                return HttpResponseBadRequest()

        if avatar.avatar_type != 1:
            return HttpResponseNotFound()

        res = useravatar_response(avatar, size=size)
        res['Cache-Control'] = FOREVER_CACHE
        return res


class UserAvatarMeView(View):
    def get(self, request):
        if not request.user.is_authenticated():
            return HttpResponseNotFound()

        size = request.GET.get('s')
        if size:
            try:
                size = int(size)
            except ValueError:
                return HttpResponseBadRequest()

        try:
            avatar = UserAvatar.objects.get(user=request.user)
        except UserAvatar.DoesNotExist:
            return HttpResponseNotFound()

        return useravatar_response(avatar, size=size)
