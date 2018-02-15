# If we detect Django 1.8 or higher, then exit
# Placed here so it's guaranteed to be imported on Django start
import django
if django.VERSION[0] > 1 or (django.VERSION[0] == 1 and django.VERSION[1] >= 9):
    raise RuntimeError(
        "Sentry's version of South does not support Django 1.8 or higher. Please use native Django migrations.")

DJANGO_17 = django.VERSION[0] > 1 or (django.VERSION[0] == 1 and django.VERSION[1] >= 7)
