import logging
from django.http import HttpResponse
from django.shortcuts import render
from raven.contrib.django.models import get_client

client = get_client()
logger = logging.getLogger(__file__)

def captureMessage(request):
    message_id = client.captureMessage("This is a message from the example Django app")
    return render(request, 'captureMessage.html', {"message_id": message_id})

def captureException(request):
    try:
        raise RuntimeError("This is an exception from the example Django app.")
    except RuntimeError:
        message_id = client.captureException()

    return render(request, 'captureException.html', {"message_id": message_id})

def loggingError(request):
    logger.error('This error was sent to a logger', exc_info=True, extra={
        # Optionally pass a request and we'll grab any information we can
        'request': request,
    })
    return render(request, 'loggingError.html', {"request": request})
