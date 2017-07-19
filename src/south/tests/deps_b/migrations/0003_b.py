from south.db import db
from django.db import models

class Migration:

    depends_on = [('deps_a', '0003_a')]

    def forwards(self):
        pass
    
    def backwards(self):
        pass

