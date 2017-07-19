from south.db import db
from django.db import models

class Migration:

    depends_on = [('deps_b', '0003_b')]

    def forwards(self):
        pass
    
    def backwards(self):
        pass

