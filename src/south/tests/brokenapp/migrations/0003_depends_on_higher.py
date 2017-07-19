from south.db import db
from django.db import models

class Migration:

    depends_on = [('brokenapp', '0004_higher')]
    
    def forwards(self):
        pass
    
    def backwards(self):
        pass

