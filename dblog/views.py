# TODO: login
from django.shortcuts import render_to_response
from django.utils.safestring import mark_safe

from dblog.helpers import FakeRequest, ImprovedExceptionReporter
from dblog.models import GroupedMessage, Message

from math import log

import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle

def index(request):
    # this only works in postgres
    message_list = list(GroupedMessage.objects.filter(
        status=0,
    ).extra(
        select={
            'score': 'times_seen / (pow((floor(extract(epoch from now() - last_seen) / 3600) + 2), 1.25) + 1)',
        }
    ).order_by('-score', '-last_seen')[0:10])
    
    for m in message_list:
        score = log(m.score)
        if score > 2:
            m.priority = 'high'
        elif score > 1:
            m.priority = 'medium'
        elif score >= 0:
            m.priority = 'low'
        elif score < 0:
            m.priority = 'verylow'
        else:
            m.priority = 'veryhigh'
    
    return render_to_response('dblog/index.html', locals())

def group(request, group_id):
    message = GroupedMessage.objects.extra(
        select={
            'score': 'times_seen / (pow((floor(extract(epoch from now() - last_seen) / 3600) + 2), 1.25) + 1)',
        }
    ).get(pk=group_id)

    score = log(message.score)
    if score > 2:
        message.priority = 'high'
    elif score > 1:
        message.priority = 'medium'
    elif score >= 0:
        message.priority = 'low'
    elif score < 0:
        message.priority = 'verylow'
    else:
        message.priority = 'veryhigh'

    message_list = Message.objects.filter(checksum=message.checksum, logger=message.logger, view=message.view)
    
    obj = message_list[0]
    if 'exc' in obj.data:
        module, args, frames = pickle.loads(base64.b64decode(obj.data['exc']).decode('zlib'))
        obj.class_name = str(obj.class_name)

        # We fake the exception class due to many issues with imports/builtins/etc
        exc_type = type(obj.class_name, (Exception,), {})
        exc_value = exc_type(obj.message)

        exc_value.args = args
    
        fake_request = FakeRequest()
        fake_request.META = obj.data.get('META', {})
        fake_request.GET = obj.data.get('GET', {})
        fake_request.POST = obj.data.get('POST', {})
        fake_request.FILES = obj.data.get('FILES', {})
        fake_request.COOKIES = obj.data.get('COOKIES', {})
        fake_request.url = obj.url
        if obj.url:
            fake_request.path_info = '/' + obj.url.split('/', 3)[-1]
        else:
            fake_request.path_info = ''

        reporter = ImprovedExceptionReporter(fake_request, exc_type, exc_value, frames)
        traceback = mark_safe(reporter.get_traceback_html())
    else:
        traceback = message.traceback
    
    unique_urls = [m[0] for m in message_list.filter(url__isnull=False).values_list('url', 'logger', 'view', 'checksum').distinct()[0:10]]
    
    return render_to_response('dblog/group.html', locals())