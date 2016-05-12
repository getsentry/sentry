from __future__ import absolute_import

from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseNotFound
from django.views.generic import View

from sentry.models import UserAvatar
from sentry.web.frontend.generic import FOREVER_CACHE


class UserAvatarPhotoView(View):

    def get_file_name(self, user):
        return '%s.png' % user.id

    def get(self, request, *args, **kwargs):
        avatar_id = kwargs['avatar_id']
        try:
            avatar = UserAvatar.objects.get(ident=avatar_id)
        except UserAvatar.DoesNotExist:
            return HttpResponseNotFound()

        photo = avatar.file
        if not photo:
            return HttpResponseNotFound()

        size = request.GET.get('s')
        photo_file = photo.getfile()
        if size:
            try:
                size = int(size)
            except ValueError:
                return HttpResponseBadRequest()
            else:
                photo_file = avatar.get_cached_photo(size)

        res = HttpResponse(photo_file, content_type='image/png')
        res['Cache-Control'] = FOREVER_CACHE
        return res
