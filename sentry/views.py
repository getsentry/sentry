# TODO: login
from django.db.models import Count
from django.shortcuts import render_to_response
from django.utils.datastructures import SortedDict
from django.utils.safestring import mark_safe

from sentry.helpers import FakeRequest, ImprovedExceptionReporter
from sentry.models import GroupedMessage, Message, LOG_LEVELS

from math import log
from pygooglechart import SimpleLineChart, Axis

import datetime

def index(request):
    logger_names = SortedDict((l, l) for l in GroupedMessage.objects.values_list('logger', flat=True).distinct())
    server_names = SortedDict((l, l) for l in Message.objects.values_list('server_name', flat=True).distinct())
    level_names = SortedDict((str(k), v) for k, v in LOG_LEVELS)

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
    
    
    today = datetime.datetime.now()

    chart_qs = Message.objects\
                      .filter(datetime__gte=today - datetime.timedelta(hours=24))\
                      .extra(select={'hour': 'extract(hour from datetime)'}).values('hour')\
                      .annotate(num=Count('id')).values_list('hour', 'num')

    if logger:
        message_list = message_list.filter(logger=logger)
        chart_qs = chart_qs.filter(logger=logger)

    if level:
        message_list = message_list.filter(level=level)
        chart_qs = chart_qs.filter(level=level)

    if server_name:
        message_list = message_list.filter(message_set__server_name=server_name).distinct()
        chart_qs = chart_qs.filter(server_name=server_name)

    rows = dict(chart_qs)
    if rows:
        max_y = max(rows.values())
    else:
        max_y = 1
    chart = SimpleLineChart(384, 130, y_range=[0, max_y])
    chart.add_data([max_y]*30)
    chart.add_data([rows.get((today-datetime.timedelta(hours=d)).hour, 0) for d in range(0, 24)][::-1])
    chart.add_data([0]*30)
    chart.fill_solid(chart.BACKGROUND, 'eeeeee')
    chart.add_fill_range('eeeeee', 0, 1)
    chart.add_fill_range('e0ebff', 1, 2)
    chart.set_colours(['eeeeee', '999999', 'eeeeee'])
    chart.set_line_style(1, 1)
    chart_url = chart.get_url()

    return render_to_response('sentry/index.html', locals())

def group(request, group_id):
    group = GroupedMessage.objects.get(pk=group_id)

    message_list = group.message_set.all()
    
    obj = message_list[0]
    if '__sentry__' in obj.data:
        module, args, frames = obj.data['__sentry__']['exc']
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

        reporter = ImprovedExceptionReporter(fake_request, exc_type, exc_value, frames, obj.data['__sentry__'].get('template'))
        traceback = mark_safe(reporter.get_traceback_html())
    else:
        traceback = mark_safe('<pre>%s</pre>' % (group.traceback,))
    
    unique_urls = message_list.filter(url__isnull=False).values_list('url', 'logger', 'view', 'checksum').annotate(times_seen=Count('url')).values('url', 'times_seen')
    
    unique_servers = message_list.filter(server_name__isnull=False).values_list('server_name', 'logger', 'view', 'checksum').annotate(times_seen=Count('server_name')).values('server_name', 'times_seen')
    
    today = datetime.datetime.now()

    chart_qs = message_list\
                      .filter(datetime__gte=today - datetime.timedelta(hours=24))\
                      .extra(select={'hour': 'extract(hour from datetime)'}).values('hour')\
                      .annotate(num=Count('id')).values_list('hour', 'num')

    rows = dict(chart_qs)
    if rows:
        max_y = max(rows.values())
    else:
        max_y = 1
    chart = SimpleLineChart(384, 130, y_range=[0, max_y])
    chart.add_data([max_y]*30)
    chart.add_data([rows.get((today-datetime.timedelta(hours=d)).hour, 0) for d in range(0, 24)][::-1])
    chart.add_data([0]*30)
    chart.fill_solid(chart.BACKGROUND, 'eeeeee')
    chart.add_fill_range('eeeeee', 0, 1)
    chart.add_fill_range('e0ebff', 1, 2)
    chart.set_colours(['eeeeee', '999999', 'eeeeee'])
    chart.set_line_style(1, 1)
    chart_url = chart.get_url()
    
    return render_to_response('sentry/group.html', locals())