from django.core.management.commands import test

from south.management.commands import patch_for_test_db_setup

class Command(test.Command):
    def handle(self, *args, **kwargs):
        patch_for_test_db_setup()
        super(Command, self).handle(*args, **kwargs)
