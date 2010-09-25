def raise_exc(request):
    raise Exception(request.GET.get('message', 'view exception'))

def decorated_raise_exc(request):
    return raise_exc(request)