"""
sentry.web.urls
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

__all__ = ('urlpatterns',)

from django.conf.urls import include, patterns, url
from django.conf import settings
from django.views.generic import RedirectView

import sentry.web.frontend.projects.keys
import sentry.web.frontend.projects.plugins
import sentry.web.frontend.projects.quotas
import sentry.web.frontend.projects.rules
import sentry.web.frontend.projects.tags

from sentry.web import api
from sentry.web.frontend import (
    accounts, generic, groups, events, admin
)

from sentry.web.frontend.admin_queue import AdminQueueView
from sentry.web.frontend.accept_organization_invite import AcceptOrganizationInviteView
from sentry.web.frontend.auth_link_identity import AuthLinkIdentityView
from sentry.web.frontend.auth_login import AuthLoginView
from sentry.web.frontend.auth_logout import AuthLogoutView
from sentry.web.frontend.auth_organization_login import AuthOrganizationLoginView
from sentry.web.frontend.auth_provider_login import AuthProviderLoginView
from sentry.web.frontend.error_page_embed import ErrorPageEmbedView
from sentry.web.frontend.home import HomeView
from sentry.web.frontend.mailgun_inbound_webhook import MailgunInboundWebhookView
from sentry.web.frontend.organization_api_keys import OrganizationApiKeysView
from sentry.web.frontend.organization_api_key_settings import OrganizationApiKeySettingsView
from sentry.web.frontend.organization_audit_log import OrganizationAuditLogView
from sentry.web.frontend.organization_auth_settings import OrganizationAuthSettingsView
from sentry.web.frontend.organization_members import OrganizationMembersView
from sentry.web.frontend.organization_member_settings import OrganizationMemberSettingsView
from sentry.web.frontend.organization_settings import OrganizationSettingsView
from sentry.web.frontend.create_organization import CreateOrganizationView
from sentry.web.frontend.create_organization_member import CreateOrganizationMemberView
from sentry.web.frontend.create_project import CreateProjectView
from sentry.web.frontend.create_team import CreateTeamView
from sentry.web.frontend.project_issue_tracking import ProjectIssueTrackingView
from sentry.web.frontend.project_notifications import ProjectNotificationsView
from sentry.web.frontend.project_release_tracking import ProjectReleaseTrackingView
from sentry.web.frontend.project_settings import ProjectSettingsView
from sentry.web.frontend.react_page import GenericReactPageView, ReactPageView
from sentry.web.frontend.release_webhook import ReleaseWebhookView
from sentry.web.frontend.remove_account import RemoveAccountView
from sentry.web.frontend.remove_organization import RemoveOrganizationView
from sentry.web.frontend.remove_project import RemoveProjectView
from sentry.web.frontend.remove_team import RemoveTeamView
from sentry.web.frontend.team_settings import TeamSettingsView


def init_all_applications():
    """
    Forces import of all applications to ensure code is registered.
    """
    from django.db.models import get_apps, get_models

    for app in get_apps():
        try:
            get_models(app)
        except Exception:
            continue

init_all_applications()

urlpatterns = patterns('')

if settings.DEBUG:
    import sentry.web.frontend.debug.mail
    from sentry.web.frontend.debug.debug_trigger_error import DebugTriggerErrorView
    from sentry.web.frontend.debug.debug_error_embed import DebugErrorPageEmbedView
    from sentry.web.frontend.debug.debug_new_release_email import DebugNewReleaseEmailView

    urlpatterns += patterns(
        '',
        url(r'^debug/mail/new-event/$',
            sentry.web.frontend.debug.mail.new_event),
        url(r'^debug/mail/new-note/$',
            sentry.web.frontend.debug.mail.new_note),
        url(r'^debug/mail/new-release/$',
            DebugNewReleaseEmailView.as_view()),
        url(r'^debug/mail/request-access/$',
            sentry.web.frontend.debug.mail.request_access),
        url(r'^debug/mail/access-approved/$',
            sentry.web.frontend.debug.mail.access_approved),
        url(r'^debug/embed/error-page/$',
            DebugErrorPageEmbedView.as_view()),
        url(r'^debug/trigger-error/$',
            DebugTriggerErrorView.as_view()),
    )

urlpatterns += patterns(
    '',
    # Store endpoints first since they are the most active
    url(r'^api/store/$', api.StoreView.as_view(),
        name='sentry-api-store'),
    url(r'^api/(?P<project_id>[\w_-]+)/store/$', api.StoreView.as_view(),
        name='sentry-api-store'),

    url(r'^_static/(?P<module>[^/]+)/(?P<path>.*)$', generic.static_media,
        name='sentry-media'),
    url(r'^templates/(?P<path>.*)$', generic.partial_static_media,
        name='sentry-partial-media'),

    # API
    url(r'^api/0/', include('sentry.api.urls')),
    url(r'^api/hooks/mailgun/inbound/', MailgunInboundWebhookView.as_view(),
        name='sentry-mailgun-inbound-hook'),
    url(r'^api/hooks/release/(?P<plugin_id>[^/]+)/(?P<project_id>[^/]+)/(?P<signature>[^/]+)/', ReleaseWebhookView.as_view(),
        name='sentry-release-hook'),
    url(r'^api/embed/error-page/$', ErrorPageEmbedView.as_view(),
        name='sentry-error-page-embed'),

    # Auth
    url(r'^auth/link/(?P<organization_slug>[^/]+)/$', AuthLinkIdentityView.as_view(),
        name='sentry-auth-link-identity'),
    url(r'^auth/login/$', AuthLoginView.as_view(),
        name='sentry-login'),
    url(r'^auth/login/(?P<organization_slug>[^/]+)/$', AuthOrganizationLoginView.as_view(),
        name='sentry-auth-organization'),
    url(r'^auth/sso/$', AuthProviderLoginView.as_view(),
        name='sentry-auth-sso'),


    url(r'^auth/logout/$', AuthLogoutView.as_view(),
        name='sentry-logout'),

    # Account
    url(r'^login-redirect/$', accounts.login_redirect,
        name='sentry-login-redirect'),
    url(r'^register/$', AuthLoginView.as_view(),
        name='sentry-register'),
    url(r'^account/sudo/$', 'sudo.views.sudo',
        {'template_name': 'sentry/account/sudo.html'},
        name='sentry-sudo'),
    url(r'^account/recover/$', accounts.recover,
        name='sentry-account-recover'),
    url(r'^account/recover/confirm/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$', accounts.recover_confirm,
        name='sentry-account-recover-confirm'),
    url(r'^account/settings/$', accounts.settings,
        name='sentry-account-settings'),
    url(r'^account/settings/appearance/$', accounts.appearance_settings,
        name='sentry-account-settings-appearance'),
    url(r'^account/settings/identities/$', accounts.list_identities,
        name='sentry-account-settings-identities'),
    url(r'^account/settings/notifications/$', accounts.notification_settings,
        name='sentry-account-settings-notifications'),
    url(r'^account/remove/$', RemoveAccountView.as_view(),
        name='sentry-remove-account'),
    url(r'^account/settings/social/', include('social_auth.urls')),

    # Admin
    url(r'^manage/$', admin.overview,
        name='sentry-admin-overview'),
    url(r'^manage/queue/$', AdminQueueView.as_view(),
        name='sentry-admin-queue'),
    url(r'^manage/status/environment/$', admin.status_env,
        name='sentry-admin-status'),
    url(r'^manage/status/packages/$', admin.status_packages,
        name='sentry-admin-packages-status'),
    url(r'^manage/status/mail/$', admin.status_mail,
        name='sentry-admin-mail-status'),

    # Admin - Teams
    url(r'^manage/teams/$', admin.manage_teams,
        name='sentry-admin-teams'),

    # Admin - Projects
    url(r'^manage/projects/$', admin.manage_projects,
        name='sentry-admin-projects'),

    # Admin - Users
    url(r'^manage/users/$', admin.manage_users,
        name='sentry-admin-users'),
    url(r'^manage/users/new/$', admin.create_new_user,
        name='sentry-admin-new-user'),
    url(r'^manage/users/(?P<user_id>\d+)/$', admin.edit_user,
        name='sentry-admin-edit-user'),
    url(r'^manage/users/(?P<user_id>\d+)/remove/$', admin.remove_user,
        name='sentry-admin-remove-user'),
    url(r'^manage/users/(?P<user_id>\d+)/projects/$', admin.list_user_projects,
        name='sentry-admin-list-user-projects'),

    # Admin - Plugins
    url(r'^manage/plugins/(?P<slug>[\w_-]+)/$', admin.configure_plugin,
        name='sentry-admin-configure-plugin'),

    # Legacy Redirects
    url(r'^docs/?$',
        RedirectView.as_view(url='https://docs.getsentry.com/hosted/', permanent=False),
        name='sentry-docs-redirect'),
    url(r'^api/?$',
        RedirectView.as_view(url='https://docs.getsentry.com/hosted/api/', permanent=False),
        name='sentry-api-docs-redirect'),

    # Organizations
    url(r'^(?P<organization_slug>[\w_-]+)/$', ReactPageView.as_view(),
        name='sentry-organization-home'),
    url(r'^organizations/new/$', CreateOrganizationView.as_view(),
        name='sentry-create-organization'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/api-keys/$', OrganizationApiKeysView.as_view(),
        name='sentry-organization-api-keys'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/api-keys/(?P<key_id>[\w_-]+)$', OrganizationApiKeySettingsView.as_view(),
        name='sentry-organization-api-key-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/auth/$', OrganizationAuthSettingsView.as_view(),
        name='sentry-organization-auth-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/audit-log/$', OrganizationAuditLogView.as_view(),
        name='sentry-organization-audit-log'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/$', OrganizationMembersView.as_view(),
        name='sentry-organization-members'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/new/$', CreateOrganizationMemberView.as_view(),
        name='sentry-create-organization-member'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/(?P<member_id>\d+)/$', OrganizationMemberSettingsView.as_view(),
        name='sentry-organization-member-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/stats/$', ReactPageView.as_view(),
        name='sentry-organization-stats'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/settings/$', OrganizationSettingsView.as_view(),
        name='sentry-organization-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/teams/(?P<team_slug>[\w_-]+)/settings/$', TeamSettingsView.as_view(),
        name='sentry-manage-team'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/teams/(?P<team_slug>[\w_-]+)/remove/$', RemoveTeamView.as_view(),
        name='sentry-remove-team'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/teams/new/$', CreateTeamView.as_view(),
        name='sentry-create-team'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/projects/new/$', CreateProjectView.as_view(),
        name='sentry-create-project'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/remove/$', RemoveOrganizationView.as_view(),
        name='sentry-remove-organization'),
    url(r'^accept/(?P<member_id>\d+)/(?P<token>\w+)/$', AcceptOrganizationInviteView.as_view(),
        name='sentry-accept-invite'),

    # Settings - Projects
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/$',
        ProjectSettingsView.as_view(),
        name='sentry-manage-project'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/issue-tracking/$',
        ProjectIssueTrackingView.as_view(),
        name='sentry-project-issue-tracking'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/release-tracking/$',
        ProjectReleaseTrackingView.as_view(),
        name='sentry-project-release-tracking'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/keys/$',
        sentry.web.frontend.projects.keys.manage_project_keys,
        name='sentry-manage-project-keys'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/keys/new/$',
        sentry.web.frontend.projects.keys.new_project_key,
        name='sentry-new-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/keys/(?P<key_id>\d+)/edit/$',
        sentry.web.frontend.projects.keys.edit_project_key,
        name='sentry-edit-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/keys/(?P<key_id>\d+)/remove/$',
        sentry.web.frontend.projects.keys.remove_project_key,
        name='sentry-remove-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/keys/(?P<key_id>\d+)/disable/$',
        sentry.web.frontend.projects.keys.disable_project_key,
        name='sentry-disable-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/keys/(?P<key_id>\d+)/enable/$',
        sentry.web.frontend.projects.keys.enable_project_key,
        name='sentry-enable-project-key'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/plugins/$',
        sentry.web.frontend.projects.plugins.manage_plugins,
        name='sentry-manage-project-plugins'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/plugins/(?P<slug>[\w_-]+)/$',
        sentry.web.frontend.projects.plugins.configure_project_plugin,
        name='sentry-configure-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/plugins/(?P<slug>[\w_-]+)/reset/$',
        sentry.web.frontend.projects.plugins.reset_project_plugin,
        name='sentry-reset-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/plugins/(?P<slug>[\w_-]+)/disable/$',
        sentry.web.frontend.projects.plugins.disable_project_plugin,
        name='sentry-disable-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/plugins/(?P<slug>[\w_-]+)/enable/$',
        sentry.web.frontend.projects.plugins.enable_project_plugin,
        name='sentry-enable-project-plugin'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/remove/$',
        RemoveProjectView.as_view(),
        name='sentry-remove-project'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/tags/$',
        sentry.web.frontend.projects.tags.manage_project_tags,
        name='sentry-manage-project-tags'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/quotas/$',
        sentry.web.frontend.projects.quotas.manage_project_quotas,
        name='sentry-manage-project-quotas'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/notifications/$',
        ProjectNotificationsView.as_view(),
        name='sentry-project-notifications'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/rules/$',
        sentry.web.frontend.projects.rules.list_rules,
        name='sentry-project-rules'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/rules/(?P<rule_id>\d+)/edit/$',
        sentry.web.frontend.projects.rules.create_or_edit_rule,
        name='sentry-edit-project-rule'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/rules/(?P<rule_id>\d+)/remove/$',
        sentry.web.frontend.projects.rules.remove_rule,
        name='sentry-remove-project-rule'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/rules/new/$',
        sentry.web.frontend.projects.rules.create_or_edit_rule,
        name='sentry-new-project-rule'),

    # Generic
    url(r'^$', HomeView.as_view(),
        name='sentry'),

    # crossdomain.xml
    url(r'^crossdomain\.xml$', api.crossdomain_xml_index,
        name='sentry-api-crossdomain-xml-index'),
    url(r'^api/(?P<project_id>[\w_-]+)/crossdomain\.xml$', api.crossdomain_xml,
        name='sentry-api-crossdomain-xml'),

    # plugins
    url(r'', include('sentry.plugins.base.urls')),

    # Generic API
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<team_slug>[\w_-]+)/groups/trends/$', api.get_group_trends,
        name='sentry-api-groups-trends'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<team_slug>[\w_-]+)/groups/newest/$', api.get_new_groups,
        name='sentry-api-groups-new'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<team_slug>[\w_-]+)/groups/resolved/$', api.get_resolved_groups,
        name='sentry-api-groups-resolved'),

    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<team_slug>[\w_-]+)/stats/$', api.get_stats,
        name='sentry-api-stats'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/tags/search/$', api.search_tags,
        name='sentry-api-search-tags'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/users/search/$', api.search_users,
        name='sentry-api-search-users'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/projects/search/$', api.search_projects,
        name='sentry-api-search-projects'),

    url(r'^share/group/(?P<share_id>[\w_-]+)/$', GenericReactPageView.as_view(auth_required=False),
        name='sentry-group-shared'),

    # TV dashboard
    url(r'^(?P<organization_slug>[\w_-]+)/teams/(?P<team_slug>[\w_-]+)/wall/$', groups.wall_display,
        name='sentry-wall'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/$', ReactPageView.as_view(),
        name='sentry-group'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/activity/$', ReactPageView.as_view(),
        name='sentry-group-activity'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/$', ReactPageView.as_view(),
        name='sentry-group-events'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id>\d+)/$', ReactPageView.as_view(),
        name='sentry-group-event'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id>\d+)/replay/$', events.replay_event,
        name='sentry-replay'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id_or_latest>(\d+|latest))/json/$', groups.group_event_details_json,
        name='sentry-group-event-json'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)/', groups.group_plugin_action,
        name='sentry-group-plugin-action'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/tags/$', ReactPageView.as_view(),
        name='sentry-group-tags'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/tags/(?P<tag_name>[^/]+)/$', ReactPageView.as_view(),
        name='sentry-group-tag-details'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/releases/$', ReactPageView.as_view(),
        name='sentry-releases'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/releases/(?P<version>[^\/]+)/$', ReactPageView.as_view(),
        name='sentry-release-details'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/releases/(?P<version>[^\/]+)/all-events/$', ReactPageView.as_view(),
        name='sentry-release-details-all-events'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/releases/(?P<version>[^\/]+)/artifacts/$', ReactPageView.as_view(),
        name='sentry-release-details-artifacts'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/dashboard/$', ReactPageView.as_view(),
        name='sentry-dashboard'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/events/$', ReactPageView.as_view(),
        name='sentry-events'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/$', ReactPageView.as_view(),
        name='sentry-stream'),

    # Legacy
    url(r'', ReactPageView.as_view()),
)
