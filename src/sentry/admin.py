from pprint import saferepr

from django import forms
from django.conf import settings
from django.conf.urls import url
from django.contrib import admin, messages
from django.contrib.auth.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.utils.decorators import method_decorator
from django.utils.translation import ugettext
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters

from sentry.models import (
    ApiKey,
    AuditLogEntry,
    AuthIdentity,
    AuthProvider,
    Option,
    Organization,
    OrganizationMember,
    Project,
    Team,
    User,
)
from sentry.utils.html import escape

csrf_protect_m = method_decorator(csrf_protect)
sensitive_post_parameters_m = method_decorator(sensitive_post_parameters())


class OptionAdmin(admin.ModelAdmin):
    list_display = ("key", "last_updated")
    fields = ("key", "value_repr", "last_updated")
    readonly_fields = ("key", "value_repr", "last_updated")
    search_fields = ("key",)

    def value_repr(self, instance):
        return '<pre style="display:inline-block;white-space:pre-wrap;">{}</pre>'.format(
            escape(saferepr(instance.value))
        )

    value_repr.short_description = "Value"
    value_repr.allow_tags = True


admin.site.register(Option, OptionAdmin)


class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "organization", "status", "date_added")
    list_filter = ("status", "public")
    search_fields = ("name", "organization__slug", "organization__name", "slug")
    raw_id_fields = ("organization",)
    readonly_fields = ("first_event", "date_added")


admin.site.register(Project, ProjectAdmin)


class OrganizationApiKeyInline(admin.TabularInline):
    model = ApiKey
    extra = 1
    fields = ("label", "key", "status", "allowed_origins", "date_added")
    raw_id_fields = ("organization",)


class OrganizationProjectInline(admin.TabularInline):
    model = Project
    extra = 1
    fields = ("name", "slug", "status", "date_added")
    raw_id_fields = ("organization",)


class OrganizationTeamInline(admin.TabularInline):
    model = Team
    extra = 1
    fields = ("name", "slug", "status", "date_added")
    raw_id_fields = ("organization",)


class OrganizationMemberInline(admin.TabularInline):
    model = OrganizationMember
    extra = 1
    fields = ("user", "organization", "role")
    raw_id_fields = ("user", "organization")


class OrganizationUserInline(OrganizationMemberInline):
    fk_name = "user"


class AuthIdentityInline(admin.TabularInline):
    model = AuthIdentity
    extra = 1
    fields = ("user", "auth_provider", "ident", "data", "last_verified")
    raw_id_fields = ("user", "auth_provider")


class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status")
    list_filter = ("status",)
    search_fields = ("name", "slug")
    fields = ("name", "slug", "status")
    inlines = (
        OrganizationMemberInline,
        OrganizationTeamInline,
        OrganizationProjectInline,
        OrganizationApiKeyInline,
    )


admin.site.register(Organization, OrganizationAdmin)


class AuthProviderAdmin(admin.ModelAdmin):
    list_display = ("organization", "provider", "date_added")
    search_fields = ("organization__name",)
    raw_id_fields = ("organization", "default_teams")
    list_filter = ("provider",)


admin.site.register(AuthProvider, AuthProviderAdmin)


class AuthIdentityAdmin(admin.ModelAdmin):
    list_display = ("user", "auth_provider", "ident", "date_added", "last_verified")
    list_filter = ("auth_provider__provider",)
    search_fields = ("user__email", "user__username", "auth_provider__organization__name")
    raw_id_fields = ("user", "auth_provider")


admin.site.register(AuthIdentity, AuthIdentityAdmin)


class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "organization", "status", "date_added")
    list_filter = ("status",)
    search_fields = ("name", "organization__name", "slug")
    raw_id_fields = ("organization",)

    def save_model(self, request, obj, form, change):
        prev_org = obj.organization_id
        super().save_model(request, obj, form, change)
        if not change:
            return
        new_org = obj.organization_id
        if new_org != prev_org:
            return

        obj.transfer_to(obj.organization)


admin.site.register(Team, TeamAdmin)


class UserChangeForm(UserChangeForm):
    username = forms.RegexField(
        label=_("Username"),
        max_length=128,
        regex=r"^[\w.@+-]+$",
        help_text=_("Required. 128 characters or fewer. Letters, digits and " "@/./+/-/_ only."),
        error_messages={
            "invalid": _(
                "This value may contain only letters, numbers and " "@/./+/-/_ characters."
            )
        },
    )


class UserCreationForm(UserCreationForm):
    username = forms.RegexField(
        label=_("Username"),
        max_length=128,
        regex=r"^[\w.@+-]+$",
        help_text=_("Required. 128 characters or fewer. Letters, digits and " "@/./+/-/_ only."),
        error_messages={
            "invalid": _(
                "This value may contain only letters, numbers and " "@/./+/-/_ characters."
            )
        },
    )


class UserAdmin(admin.ModelAdmin):
    add_form_template = "admin/auth/user/add_form.html"
    change_user_password_template = None
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (_("Personal info"), {"fields": ("name", "email")}),
        (_("Permissions"), {"fields": ("is_active", "is_staff", "is_superuser")}),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("username", "password1", "password2")}),
    )
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm
    list_display = ("username", "email", "name", "is_staff", "date_joined")
    list_filter = ("is_staff", "is_superuser", "is_active", "is_managed")
    search_fields = ("username", "name", "email")
    ordering = ("username",)
    inlines = (OrganizationUserInline, AuthIdentityInline)

    def get_fieldsets(self, request, obj=None):
        if not obj:
            return self.add_fieldsets
        return super().get_fieldsets(request, obj)

    def get_form(self, request, obj=None, **kwargs):
        """
        Use special form during user creation
        """
        defaults = {}
        if obj is None:
            defaults.update(
                {"form": self.add_form, "fields": admin.util.flatten_fieldsets(self.add_fieldsets)}
            )
        defaults.update(kwargs)
        return super().get_form(request, obj, **defaults)

    def get_urls(self):
        return [
            url(r"^(\d+)/password/$", self.admin_site.admin_view(self.user_change_password))
        ] + super().get_urls()

    def lookup_allowed(self, lookup, value):
        # See #20078: we don't want to allow any lookups involving passwords.
        if lookup.startswith("password"):
            return False
        return super().lookup_allowed(lookup, value)

    @sensitive_post_parameters_m
    @csrf_protect_m
    @transaction.atomic
    def add_view(self, request, form_url="", extra_context=None):
        # It's an error for a user to have add permission but NOT change
        # permission for users. If we allowed such users to add users, they
        # could create superusers, which would mean they would essentially have
        # the permission to change users. To avoid the problem entirely, we
        # disallow users from adding users if they don't have change
        # permission.
        if not self.has_change_permission(request):
            if self.has_add_permission(request) and settings.DEBUG:
                # Raise Http404 in debug mode so that the user gets a helpful
                # error message.
                raise Http404(
                    'Your user does not have the "Change user" permission. In '
                    "order to add users, Django requires that your user "
                    'account have both the "Add user" and "Change user" '
                    "permissions set."
                )
            raise PermissionDenied
        if extra_context is None:
            extra_context = {}
        username_field = self.model._meta.get_field(self.model.USERNAME_FIELD)
        defaults = {"auto_populated_fields": (), "username_help_text": username_field.help_text}
        extra_context.update(defaults)
        return super().add_view(request, form_url, extra_context)

    @sensitive_post_parameters_m
    def user_change_password(self, request, id, form_url=""):
        if not self.has_change_permission(request):
            raise PermissionDenied
        user = get_object_or_404(self.queryset(request), pk=id)
        if request.method == "POST":
            form = self.change_password_form(user, request.POST)
            if form.is_valid():
                form.save()
                msg = ugettext("Password changed successfully.")
                messages.success(request, msg)
                return HttpResponseRedirect("..")
        else:
            form = self.change_password_form(user)

        fieldsets = [(None, {"fields": list(form.base_fields)})]
        adminForm = admin.helpers.AdminForm(form, fieldsets, {})

        context = {
            "title": _("Change password: %s") % escape(user.get_username()),
            "adminForm": adminForm,
            "form_url": form_url,
            "form": form,
            "is_popup": "_popup" in request.GET,
            "add": True,
            "change": False,
            "has_delete_permission": False,
            "has_change_permission": True,
            "has_absolute_url": False,
            "opts": self.model._meta,
            "original": user,
            "save_as": False,
            "show_save": True,
        }
        return TemplateResponse(
            request,
            self.change_user_password_template or "admin/auth/user/change_password.html",
            context,
            current_app=self.admin_site.name,
        )

    def response_add(self, request, obj, post_url_continue=None):
        """
        Determines the HttpResponse for the add_view stage. It mostly defers to
        its superclass implementation but is customized because the User model
        has a slightly different workflow.
        """
        # We should allow further modification of the user just added i.e. the
        # 'Save' button should behave like the 'Save and continue editing'
        # button except in two scenarios:
        # * The user has pressed the 'Save and add another' button
        # * We are adding a user in a popup
        if "_addanother" not in request.POST and "_popup" not in request.POST:
            request.POST["_continue"] = 1
        return super().response_add(request, obj, post_url_continue)


admin.site.register(User, UserAdmin)


class AuditLogEntryAdmin(admin.ModelAdmin):
    list_display = ("event", "organization", "actor", "datetime")
    list_filter = ("event", "datetime")
    search_fields = ("actor__email", "organization__name", "organization__slug")
    raw_id_fields = ("organization", "actor", "target_user")
    readonly_fields = (
        "organization",
        "actor",
        "actor_key",
        "target_object",
        "target_user",
        "event",
        "ip_address",
        "data",
        "datetime",
    )


admin.site.register(AuditLogEntry, AuditLogEntryAdmin)
