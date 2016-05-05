from __future__ import absolute_import

from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseNotFound
from django.views.generic import View

from sentry.models import UserAvatar


class UserAvatarPhotoView(View):
    ALLOWED_SIZES = (20, 48, 52, 64, 80, 96)

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
        return HttpResponse(photo_file, content_type='image/png')
