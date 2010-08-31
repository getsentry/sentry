# TODO: login
from django.db.models import Count
from django.shortcuts import render_to_response
from django.utils.safestring import mark_safe

from dblog.helpers import FakeRequest, ImprovedExceptionReporter
from dblog.models import GroupedMessage, Message, LOG_LEVELS

from math import log

import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle

def index(request):
    logger_names = dict((l, l) for l in GroupedMessage.objects.values_list('logger', flat=True).distinct())
    server_names = dict((l, l) for l in GroupedMessage.objects.values_list('server_name', flat=True).distinct())
    level_names = dict((str(k), v) for k, v in LOG_LEVELS)

    logger = request.GET.get('logger')
    server_name = request.GET.get('server_name') or ''
    level = request.GET.get('level') or ''

    if logger not in logger_names:
        logger = ''

    if server_name not in server_names:
        server_name = ''

    if level not in level_names:
        level = ''

    # this only works in postgres
    message_list = GroupedMessage.objects.filter(
        status=0,
    ).extra(
        select={
            'score': 'times_seen / (pow((floor(extract(epoch from now() - last_seen) / 3600) + 2), 1.25) + 1)',
        }
    ).order_by('-score', '-last_seen')

    if logger:
        message_list = message_list.filter(logger=logger)

    if level:
        message_list = message_list.filter(level=level)

    if server_name:
        message_list = message_list.filter(server_name=server_name)

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
        traceback = mark_safe('<pre>%s</pre>' % (message.traceback,))
    
    unique_urls = message_list.filter(url__isnull=False).values_list('url', 'logger', 'view', 'checksum').annotate(times_seen=Count('url')).values('url', 'times_seen')
    
    unique_servers = message_list.filter(server_name__isnull=False).values_list('server_name', 'logger', 'view', 'checksum').annotate(times_seen=Count('server_name')).values('server_name', 'times_seen')
    
    return render_to_response('dblog/group.html', locals())