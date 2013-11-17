from django.dispatch import Signal


# This module is deprecated, this signals aren't used by the code anymore
# and it's functionality should be replaced by pipeline methods.


pre_update = Signal(providing_args=['user', 'response', 'details'])
socialauth_registered = Signal(providing_args=['user', 'response', 'details'])
