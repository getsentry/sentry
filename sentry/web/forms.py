from bitfield import BitHandler
from itertools import chain

from django import forms
from django.contrib.auth.models import User
from django.utils.encoding import force_unicode
from django.utils.html import conditional_escape
from django.utils.safestring import mark_safe

from sentry.models import Project, ProjectMember, PERMISSIONS
from sentry.interfaces import Http


class CheckboxSelectMultiple(forms.CheckboxSelectMultiple):
    """
    This is identical to Django's builtin widget, except that
    it renders as <ul.inputs-list>. Would be great if we didn't
    have to create this stupid code, but Django widgets are not
    flexible.
    """
    def render(self, name, value, attrs=None, choices=()):
        if value is None:
            value = []
        has_id = attrs and 'id' in attrs
        final_attrs = self.build_attrs(attrs, name=name)
        output = [u'<ul class="inputs-list">']
        # Normalize to strings
        str_values = set([force_unicode(v) for v in value])
        for i, (option_value, option_label) in enumerate(chain(self.choices, choices)):
            # If an ID attribute was given, add a numeric index as a suffix,
            # so that the checkboxes don't all have the same ID attribute.
            if has_id:
                final_attrs = dict(final_attrs, id='%s_%s' % (attrs['id'], i))
                label_for = u' for="%s"' % final_attrs['id']
            else:
                label_for = ''

            cb = forms.CheckboxInput(final_attrs, check_test=lambda value: value in str_values)
            option_value = force_unicode(option_value)
            rendered_cb = cb.render(name, option_value)
            option_label = conditional_escape(force_unicode(option_label))
            output.append(u'<li><label%s>%s %s</label></li>' % (label_for, rendered_cb, option_label))
        output.append(u'</ul>')
        return mark_safe(u'\n'.join(output))


class BitFieldCheckboxSelectMultiple(CheckboxSelectMultiple):
    def render(self, name, value, attrs=None, choices=()):
        if value is not None:
            value = [k for k, v in value if v]
        return super(BitFieldCheckboxSelectMultiple, self).render(
          name, value, attrs=attrs, choices=choices)

    def _has_changed(self, initial, data):
        if initial is None:
            initial = []
        if data is None:
            data = []
        if initial != data:
            return True
        initial_set = set([force_unicode(value) for value in initial])
        data_set = set([force_unicode(value) for value in data])
        return data_set != initial_set


class UserField(forms.CharField):
    class widget(forms.widgets.TextInput):
        def render(self, name, value, attrs=None):
            if not attrs:
                attrs = {}
            if 'placeholder' not in attrs:
                attrs['placeholder'] = 'username'
            if isinstance(value, int):
                value = unicode(User.objects.get(pk=value))
            return super(UserField.widget, self).render(name, value, attrs)

    def clean(self, value):
        value = super(UserField, self).clean(value)
        if not value:
            return None
        try:
            return User.objects.get(username=value)
        except User.DoesNotExist:
            raise forms.ValidationError(u'invalid user name')


class NewProjectForm(forms.ModelForm):
    class Meta:
        fields = ('name',)
        model = Project


class EditProjectForm(forms.ModelForm):
    class Meta:
        fields = ('name',)
        model = Project


class ProjectMemberForm(forms.ModelForm):
    user = UserField()
    permissions = forms.MultipleChoiceField(choices=PERMISSIONS, widget=BitFieldCheckboxSelectMultiple(), required=False)
    is_superuser = forms.BooleanField(required=False)

    class Meta:
        fields = ('is_superuser', 'permissions', 'user')
        model = ProjectMember

    # def __init__(self, project, *args, **kwargs):
    #     self.project = project
    #     super(ProjectMemberForm, self).__init__(*args, **kwargs)

    def clean_user(self):
        value = self.cleaned_data['user']
        if not value:
            return None

        # if self.project.member_set.filter(user=value).exists():
        #     raise forms.ValidationError('User already a member of project')

        return value

    def clean_permissions(self):
        value = self.cleaned_data['permissions']
        if not value:
            return 0

        result = BitHandler(0, ProjectMember.permissions.keys())
        for k in value:
            setattr(result, k, True)
        return int(result)


class ReplayForm(forms.Form):
    url = forms.URLField()
    method = forms.ChoiceField(choices=((k, k) for k in Http.METHODS))
    data = forms.CharField(required=False, widget=forms.Textarea())
    headers = forms.CharField(required=False, widget=forms.Textarea())

    def clean_headers(self):
        value = self.cleaned_data.get('headers')
        if not value:
            return

        return dict(line.split(': ') for line in value.split('\n'))
