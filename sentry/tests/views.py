from django.shortcuts import get_object_or_404, render_to_response

def django_exc(request):
    return get_object_or_404(Exception, pk=1)

def raise_exc(request):
    raise Exception(request.GET.get('message', 'view exception'))

def decorated_raise_exc(request):
    return raise_exc(request)

def template_exc(request):
    return render_to_response('sentry-tests/error.html')