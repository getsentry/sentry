from django import template
register = template.Library()

def with_priority(result_list, key='score'):
    if isinstance(result_list[0], dict):
        _get = lambda x, k: x[k]
    else:
        _get = lambda x, k: getattr(x, k)

    min_, max_ = min([_get(r, key) for r in result_list]), max([_get(r, key) for r in result_list])
    mid = (max_ - min_) / 4
    for result in result_list:
        val = _get(result, key)
        if val > max_ - mid:
            priority = 'veryhigh'
        elif val > max_ - mid * 2:
            priority = 'high'
        elif val > max_ - mid * 3:
            priority = 'medium'
        elif val > max_ - mid * 4:
            priority = 'low'
        else:
            priority = 'verylow'
        yield result, priority
with_priority = register.filter(with_priority)