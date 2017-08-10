"""                                                 
South introspection rules for django-audit-log
"""                                                 
                                                    
from django.contrib.auth.models import User
from django.conf import settings
from south.modelsinspector import add_introspection_rules

if "audit_log" in settings.INSTALLED_APPS:
    try:                                                
        # Try and import the field so we can see if audit_log is available
        from audit_log.models import fields

        # Make sure the `to` and `null` parameters will be ignored
        rules = [(                                     
            (fields.LastUserField,),                   
            [],                                        
            {                                          
                'to': ['rel.to', {'default': User}],   
                'null': ['null', {'default': True}],   
            },                                         
        )]                                             

        # Add the rules for the `LastUserField`
        add_introspection_rules(                           
            rules,                                         
            ['^audit_log\.models\.fields\.LastUserField'], 
        )                                                  
    except ImportError:                                 
        pass
