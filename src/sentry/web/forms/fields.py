from django.forms import CharField, EmailField, Field, TypedChoiceField, ValidationError
from django.forms.utils import flatatt
from django.forms.widgets import TextInput, Widget
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry.models import User
from sentry.security import is_valid_email_address


class CustomTypedChoiceField(TypedChoiceField):
    # A patched version of TypedChoiceField which correctly validates a 0
    # as a real input that may be invalid
    # See https://github.com/django/django/pull/3774
    def validate(self, value):
        """
        Validates that the input is in self.choices.
        """
        super().validate(value)
        # this will validate itself twice due to the internal ChoiceField
        # validation
        if value is not None and not self.valid_value(value):
            raise ValidationError(
                self.error_messages["invalid_choice"],
                code="invalid_choice",
                params={"value": value},
            )


class UserField(CharField):
    class widget(TextInput):
        def render(self, name, value, attrs=None):
            if not attrs:
                attrs = {}
            if "placeholder" not in attrs:
                attrs["placeholder"] = "username"
            if isinstance(value, int):
                value = User.objects.get(id=value).username
            return super(UserField.widget, self).render(name, value, attrs)

    def clean(self, value):
        value = super().clean(value)
        if not value:
            return None
        try:
            return User.objects.get(username=value, is_active=True)
        except User.DoesNotExist:
            raise ValidationError(_("Invalid username"))


class ReadOnlyTextWidget(Widget):
    def render(self, name, value, attrs):
        final_attrs = self.build_attrs(attrs)
        if not value:
            value = mark_safe("<em>%s</em>" % _("Not set"))
        return format_html("<div{0}>{1}</div>", flatatt(final_attrs), value)


class ReadOnlyTextField(Field):
    widget = ReadOnlyTextWidget

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("required", False)
        super().__init__(*args, **kwargs)

    def bound_data(self, data, initial):
        # Always return initial because the widget doesn't
        # render an input field.
        return initial


def email_address_validator(value):
    if not is_valid_email_address(value):
        raise ValidationError(_("Enter a valid email address."), code="invalid")
    return value


class AllowedEmailField(EmailField):
    default_validators = EmailField.default_validators + [email_address_validator]
