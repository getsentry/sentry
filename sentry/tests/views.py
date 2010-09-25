from django.shortcuts import get_object_or_404

def django_exc(request):
    return get_object_or_404(Exception, pk=1)

def raise_exc(request):
    raise Exception(request.GET.get('message', 'view exception'))

def decorated_raise_exc(request):
    return raise_exc(request)