import logging

from django.conf import settings
from django.utils.hashcompat import md5_constructor

_FILTER_CACHE = None
def get_filters():
    global _FILTER_CACHE
    
    if _FILTER_CACHE is None:
        from sentry import settings
        
        filters = []
        for filter_ in settings.FILTERS:
            module_name, class_name = filter_.rsplit('.', 1)
            try:
                module = __import__(module_name, {}, {}, class_name)
                filter_ = getattr(module, class_name)
            except Exception, exc:
                logging.exception('Unable to import %s' % (filter_,))
                continue
            filters.append(filter_)
        _FILTER_CACHE = filters
    for f in _FILTER_CACHE:
        yield f

def construct_checksum(level=logging.ERROR, class_name='', traceback='', message='', **kwargs):
    checksum = md5_constructor(str(level))
    checksum.update(class_name or '')
    message = traceback or message
    if isinstance(message, unicode):
        message = message.encode('utf-8', 'replace')
    checksum.update(message)
    return checksum.hexdigest()

def varmap(func, var):
    if isinstance(var, dict):
        return dict((k, varmap(func, v)) for k, v in var.iteritems())
    elif isinstance(var, (list, tuple)):
        return [varmap(func, f) for f in var]
    else:
        return func(var)

def transform(value):
    if isinstance(value, (tuple, list)):
        return [transform(o) for o in value]
    elif isinstance(value, dict):
        return dict((k, transform(v)) for k, v in value.iteritems())
    elif not isinstance(value, (int, bool, basestring)) and value is not None:
        return unicode(value)
    return value

def get_installed_apps():
    """
    Generate a list of modules in settings.INSTALLED_APPS.
    """
    out = set()
    for app in settings.INSTALLED_APPS:
        out.add(app.split('.')[0])
    return out