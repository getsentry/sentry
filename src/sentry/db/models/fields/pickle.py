from picklefield.fields import PickledObjectField


class UnicodePickledObjectField(PickledObjectField):
    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, str):
            value = value.decode('utf-8')
        return super(UnicodePickledObjectField, self).get_db_prep_value(
            value, *args, **kwargs)


from south.modelsinspector import add_introspection_rules
add_introspection_rules([], ['^sentry\.db\.models\.fields\.pickle\.UnicodePickledObjectField'])
