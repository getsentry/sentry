from django.conf import settings
from django.conf.urls.defaults import *
from django.utils.hashcompat import md5_constructor

from feeds import ErrorFeed, SummaryFeed

hashed_secret = md5_constructor(settings.SECRET_KEY).hexdigest()

urlpatterns = patterns('',
    url(r'feeds/%s/messages.xml' % hashed_secret, ErrorFeed(), name='dblog-feed-messages'),
    url(r'feeds/%s/summaries.xml' % hashed_secret, SummaryFeed(), name='dblog-feed-summaries'),
)
