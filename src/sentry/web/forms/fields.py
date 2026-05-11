from django.forms import EmailField, TypedChoiceField, ValidationError
from django.utils.translation import gettext_lazy as _

from sentry.utils.email.address import is_valid_email_address


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


def email_address_validator(value):
    if not is_valid_email_address(value):
        raise ValidationError(_("Enter a valid email address."), code="invalid")
    return value


class AllowedEmailField(EmailField):
    default_validators = EmailField.default_validators + [email_address_validator]
