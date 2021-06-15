"""
sudo.decorators
~~~~~~~~~~~~~~~

:copyright: (c) 2020 by Matt Robenolt.
:license: BSD, see LICENSE for more details.
"""
from functools import wraps

from sudo.views import redirect_to_sudo


def sudo_required(func):
    """
    Enforces a view to have elevated privileges.
    Should likely be paired with ``@login_required``.

    >>> @sudo_required
    >>> def secure_page(request):
    >>>     ...
    """

    @wraps(func)
    def inner(request, *args, **kwargs):
        if not request.is_sudo():
            return redirect_to_sudo(request.get_full_path())
        return func(request, *args, **kwargs)

    return inner
