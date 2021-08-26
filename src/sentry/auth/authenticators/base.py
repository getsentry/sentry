from enum import Enum

from django.core.cache import cache
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.utils.otp import TOTP, generate_secret_key


class ActivationResult:
    type = None


class ActivationMessageResult(ActivationResult):
    def __init__(self, message, type="info"):
        assert type in ("error", "warning", "info")
        self.type = type
        self.message = message

    def __str__(self):
        return self.message

    def __repr__(self):
        return f"<{type(self).__name__}: {self.message}>"


class ActivationChallengeResult(ActivationResult):
    type = "challenge"

    def __init__(self, challenge):
        self.challenge = challenge


class EnrollmentStatus(Enum):
    NEW = "new"
    MULTI = "multi"
    ROTATION = "rotation"
    EXISTING = "existing"


class AuthenticatorInterface:
    type = -1
    interface_id = None
    name = None
    description = None
    rotation_warning = None
    is_backup_interface = False
    enroll_button = _("Enroll")
    configure_button = _("Info")
    remove_button = _("Remove")
    is_available = True
    allow_multi_enrollment = False
    allow_rotation_in_place = False

    def __init__(self, authenticator=None, status=EnrollmentStatus.EXISTING):
        self.authenticator = authenticator
        self.status = status

    @classmethod
    def generate(cls, status):
        # Convenience method to build new instances either from the
        # class or existing instances. That is, it's nicer than doing
        # `type(interface)()`.
        return cls(status=status)

    def is_enrolled(self):
        """Returns `True` if the interfaces is enrolled (eg: has an
        authenticator for a user attached).
        """
        return self.authenticator is not None

    @property
    def requires_activation(self):
        """If the interface has an activation method that needs to be
        called this returns `True`.
        """
        return self.activate.__func__ is not AuthenticatorInterface.activate

    @property
    def can_validate_otp(self):
        """If the interface is able to validate OTP codes then this returns
        `True`.
        """
        return self.validate_otp.__func__ is not AuthenticatorInterface.validate_otp

    @property
    def config(self):
        """Returns the configuration dictionary for this interface.  If
        the interface is registered with an authenticator (eg: it is
        enrolled) then the authenticator's config is returned, otherwise
        a new config is used on first access.
        """
        if self.authenticator is not None:
            return self.authenticator.config
        rv = getattr(self, "_unbound_config", None)
        if rv is None:
            # Prevent bad recursion if stuff wants to access the default
            # config
            self._unbound_config = {}
            rv = self._unbound_config = self.generate_new_config()
        return rv

    def generate_new_config(self):
        """This method is invoked if a new config is required."""
        return {}

    def activate(self, request):
        """If an authenticator overrides this then the method is called
        when the dialog for authentication is brought up.  The returned string
        is then rendered in the UI.
        """
        # This method needs to be empty for the default
        # `requires_activation` property to make sense.

    def enroll(self, user):
        """Invoked to enroll a user for this interface.  If already enrolled
        an error is raised.
        """
        from sentry.models import Authenticator

        if self.authenticator is None:
            self.authenticator = Authenticator.objects.create(
                user=user, type=self.type, config=self.config
            )
        else:
            if not self.allow_multi_enrollment:
                raise Authenticator.AlreadyEnrolled()
            self.authenticator.config = self.config
            self.authenticator.save()

    def rotate_in_place(self):
        if not self.allow_rotation_in_place:
            raise Exception("This interface does not allow rotation in place")
        if self.authenticator is None:
            raise Exception("There is no Authenticator to rotate")

        self.authenticator.config = self.config
        self.authenticator.created_at = timezone.now()
        self.authenticator.last_used_at = None
        self.authenticator.save()

    def validate_otp(self, otp):
        """This method is invoked for an OTP response and has to return
        `True` or `False` based on the validity of the OTP response.  Note
        that this can be called with otp responses from other interfaces.
        """
        return False

    def validate_response(self, request, challenge, response):
        """If the activation generates a challenge that needs to be
        responded to this validates the response for that challenge.  This
        is only ever called for challenges emitted by the activation of this
        activation interface.
        """
        return False


class OtpMixin:
    def generate_new_config(self):
        return {"secret": generate_secret_key()}

    def _get_secret(self):
        return self.config["secret"]

    def _set_secret(self, secret):
        self.config["secret"] = secret

    secret = property(_get_secret, _set_secret)
    del _get_secret, _set_secret

    def make_otp(self):
        return TOTP(self.secret)

    def _get_otp_counter_cache_key(self, counter):
        if self.authenticator is not None:
            return f"used-otp-counters:{self.authenticator.user_id}:{counter}"

    def check_otp_counter(self, counter):
        # OTP uses an internal counter that increments every 30 seconds.
        # A hash function generates a six digit code based on the counter
        # and a secret key.  If the generated PIN was used it is marked in
        # redis as used by remembering which counter it was generated
        # from.  This is what we check for here.
        cache_key = self._get_otp_counter_cache_key(counter)
        return cache_key is None or cache.get(cache_key) != "1"

    def mark_otp_counter_used(self, counter):
        cache_key = self._get_otp_counter_cache_key(counter)
        if cache_key is not None:
            # Mark us used for three windows
            cache.set(cache_key, "1", timeout=120)

    def validate_otp(self, otp):
        if not otp:
            return False
        otp = otp.strip().replace("-", "").replace(" ", "")
        used_counter = self.make_otp().verify(
            otp, return_counter=True, check_counter_func=self.check_otp_counter
        )
        if used_counter is not None:
            self.mark_otp_counter_used(used_counter)
            return True
        return False
