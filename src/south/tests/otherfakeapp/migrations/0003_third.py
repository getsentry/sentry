from south.db import db
from django.db import models

class Migration:
    
    depends_on = (
        ("fakeapp", "0003_alter_spam"),
    )
    
    def forwards(self):
        pass
    
    def backwards(self):
        pass
