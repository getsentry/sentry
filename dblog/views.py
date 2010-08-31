# TODO: login
from django.shortcuts import render_to_response

from dblog.models import GroupedMessage

from math import log

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
    
    message = message_list[0]
    
    return render_to_response('dblog/index.html', locals())

def group(request, group_id):
    message = GroupedMessage.objects.extra(
        select={
            'score': 'times_seen / (pow((floor(extract(epoch from now() - last_seen) / 3600) + 2), 1.25) + 1)',
        }
    ).get(pk=group_id)
    
    try:
        prev_message = GroupedMessage.objects.filter(id__gt=group_id).order_by('id')[0]
    except IndexError:
        prev_message = None

    try:
        next_message = GroupedMessage.objects.filter(id__lt=group_id).order_by('-id')[0]
    except IndexError:
        next_message = None
    
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
    
    return render_to_response('dblog/group.html', locals())