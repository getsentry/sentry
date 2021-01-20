# HACK(dcramer): Django doesn't play well with our naming schemes, and we prefer
# our methods ways over Django's limited scoping
from .django.models import *  # NOQA
