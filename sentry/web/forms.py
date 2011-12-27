from bitfield import BitHandler
from itertools import chain

from django import forms
from django.contrib.auth.models import User
from django.utils.encoding import force_unicode
from django.utils.html import conditional_escape
from django.utils.safestring import mark_safe

from sentry.models import Project, ProjectMember, PERMISSIONS
from sentry.interfaces import Http


class RadioFieldRenderer(forms.widgets.RadioFieldRenderer):
    """
    This is identical to Django's builtin widget, except that
    it renders as <ul.inputs-list>. Would be great if we didn't
    have to create this stupid code, but Django widgets are not
    flexible.
    """
    def render(self):
        """Outputs a <ul> for this set of radio fields."""
        return mark_safe(u'<ul class="inputs-list">\n%s\n</ul>' % u'\n'.join([u'<li>%s</li>'
                % force_unicode(w) for w in self]))


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


class RemoveProjectForm(forms.Form):
    removal_type = forms.ChoiceField(choices=(
        ('1', 'Remove all attached events.'),
        ('2', 'Migrate events to another project.'),
        ('3', 'Hide this project.'),
    ), widget=forms.RadioSelect(renderer=RadioFieldRenderer))
    project = forms.ChoiceField(choices=(), required=False)

    def __init__(self, project_list, *args, **kwargs):
        super(RemoveProjectForm, self).__init__(*args, **kwargs)
        if not project_list:
            del self.fields['project']
            self.fields['removal_type'].choices = filter(lambda x: x[0] != 2, self.fields['removal_type'].choices)
        else:
            self.fields['project'].choices = [(p.pk, p.name) for p in project_list]
            self.fields['project'].widget.choices = self.fields['project'].choices

    def clean(self):
        data = self.cleaned_data
        if data.get('removal_type') == 2 and not data.get('project'):
            raise forms.ValidationError('You must select a project to migrate data')
        return data


class NewProjectForm(forms.ModelForm):
    class Meta:
        fields = ('name',)
        model = Project


class EditProjectForm(forms.ModelForm):
    class Meta:
        fields = ('name', 'status')
        model = Project


class BaseProjectMemberForm(forms.ModelForm):
    permissions = forms.MultipleChoiceField(choices=PERMISSIONS, widget=BitFieldCheckboxSelectMultiple(), required=False)
    is_superuser = forms.BooleanField(required=False, help_text="Grants the user all permissions")

    class Meta:
        fields = ('is_superuser', 'permissions')
        model = ProjectMember

    def __init__(self, project, *args, **kwargs):
        self.project = project
        super(BaseProjectMemberForm, self).__init__(*args, **kwargs)

    def clean_permissions(self):
        value = self.cleaned_data['permissions']
        if not value:
            return 0

        result = BitHandler(0, ProjectMember.permissions.keys())
        for k in value:
            setattr(result, k, True)
        return int(result)


EditProjectMemberForm = BaseProjectMemberForm


class NewProjectMemberForm(BaseProjectMemberForm):
    user = UserField()

    class Meta:
        fields = ('user', 'is_superuser', 'permissions')
        model = ProjectMember

    def clean_user(self):
        value = self.cleaned_data['user']
        if not value:
            return None

        if self.project.member_set.filter(user=value).exists():
            raise forms.ValidationError('User already a member of project')

        return value


class ReplayForm(forms.Form):
    url = forms.URLField(widget=forms.TextInput(attrs={'class': 'span8'}))
    method = forms.ChoiceField(choices=((k, k) for k in Http.METHODS))
    data = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'span8'}))
    headers = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'span8'}))

    def clean_headers(self):
        value = self.cleaned_data.get('headers')
        if not value:
            return

        return dict(line.split(': ') for line in value.split('\n'))
