from django.contrib.admin.templatetags.admin_list import result_headers, items_for_result
from django import template
register = template.Library()

def better_results(cl):
    for res in cl.result_list:
        cells = list(items_for_result(cl, res, None))
        yield dict(
            cells=cells,
            instance=res,
            num_real_cells=len(cells) - 1,
        )

def result_list(cl):
    return {'cl': cl,
            'result_headers': list(result_headers(cl)),
            'results': list(better_results(cl))}
result_list = register.inclusion_tag("admin/djangodblog/errorbatch/change_list_results.html")(result_list)