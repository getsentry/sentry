from django.core.urlresolvers import reverse
from django.http import HttpResponse
from django.utils import feedgenerator
from django.utils.translation import ugettext_lazy as _

from sentry.models import Message, GroupedMessage

class MessageFeed(object):
    def __call__(self, request):
        feed_dict = {
            'title': self.get_title(request),
            'link': request.build_absolute_uri(self.get_link(request)),
            'description': '',
            'language': u'en',
            'feed_url': request.build_absolute_uri(),
        }
        feed = feedgenerator.Rss201rev2Feed(**feed_dict)

        qs = self.get_query_set(request)

        for obj in qs[0:10]:
            link = self.get_item_url(request, obj)
            if link:
                link = request.build_absolute_uri(link)
            feed.add_item(
                title=str(obj or ''),
                link=link,
                description=obj.description() or '',
                pubdate=self.get_item_date(request, obj) or '',
            )

        return HttpResponse(feed.writeString('utf-8'), mimetype='application/xml')

    def get_title(self, request):
        return _('log messages')

    def get_link(self, request):
        return reverse('sentry')

    def get_model(self, request):
        return Message

    def get_query_set(self, request):
        qs = self.get_model(request).objects.all().order_by(self.get_order_field(request))
        if request.GET.get('level') > 0:
            qs = qs.filter(level__gte=request.GET['level'])
        elif request.GET.get('server_name'):
            qs = qs.filter(server_name=request.GET['server_name'])
        elif request.GET.get('logger'):
            qs = qs.filter(logger=request.GET['logger'])
        elif request.GET.get('site'):
            qs = qs.filter(site=request.GET['site'])
        return qs

    def get_order_field(self, request):
        return '-datetime'

    def get_item_url(self, request, obj):
        return reverse('sentry-group', args=[obj.group_id])

    def get_item_date(self, request, obj):
        return obj.datetime

class SummaryFeed(MessageFeed):
    def get_title(self, request):
        return _('log summaries')

    def get_link(self, request):
        return reverse('sentry')

    def get_model(self, request):
        return GroupedMessage

    def get_query_set(self, request):
        qs = super(SummaryFeed, self).get_query_set(request)
        return qs.filter(status=0)

    def get_order_field(self, request):
        return '-last_seen'

    def get_item_url(self, request, obj):
        return reverse('sentry-group', args=[obj.pk])

    def get_item_date(self, request, obj):
        return obj.last_seen