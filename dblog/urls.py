from django.conf import settings
from django.conf.urls.defaults import *
from django.utils.hashcompat import md5_constructor

from feeds import MessageFeed, SummaryFeed
import views

hashed_secret = md5_constructor(settings.SECRET_KEY).hexdigest()

urlpatterns = patterns('',
    url(r'^feeds/%s/messages.xml$' % hashed_secret, MessageFeed(), name='dblog-feed-messages'),
    url(r'^feeds/%s/summaries.xml$' % hashed_secret, SummaryFeed(), name='dblog-feed-summaries'),
    url(r'^group/(\d+)$', views.group, name='dblog-group'),
    url(r'^$', views.index, name='dblog'),
)
