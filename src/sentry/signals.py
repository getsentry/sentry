import django

regression_signal = django.dispatch.Signal(providing_args=["instance"])
