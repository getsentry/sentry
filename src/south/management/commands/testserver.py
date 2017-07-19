from django.core.management.commands import testserver

from south.management.commands import patch_for_test_db_setup

class Command(testserver.Command):
    def handle(self, *args, **kwargs):
        patch_for_test_db_setup()
        super(Command, self).handle(*args, **kwargs)
