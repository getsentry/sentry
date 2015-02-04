"""
sentry.web.urls
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

try:
    from django.conf.urls import include, patterns, url
except ImportError:
    # django < 1.5 compat
    from django.conf.urls.defaults import include, patterns, url  # NOQA

from django.conf import settings

from sentry.web import api
from sentry.web.frontend import (
    alerts, accounts, generic, groups, events,
    admin, users, explore, explore_code,
)

import sentry.web.frontend.projects.general
import sentry.web.frontend.projects.keys
import sentry.web.frontend.projects.notifications
import sentry.web.frontend.projects.plugins
import sentry.web.frontend.projects.quotas
import sentry.web.frontend.projects.rules
import sentry.web.frontend.projects.tags

__all__ = ('urlpatterns',)

from sentry.web.frontend.accept_organization_invite import AcceptOrganizationInviteView
from sentry.web.frontend.access_group_migration import AccessGroupMigrationView
from sentry.web.frontend.auth_login import AuthLoginView
from sentry.web.frontend.auth_logout import AuthLogoutView
from sentry.web.frontend.home import HomeView
from sentry.web.frontend.help_index import HelpIndexView
from sentry.web.frontend.help_page import HelpPageView
from sentry.web.frontend.help_platform_details import HelpPlatformDetailsView
from sentry.web.frontend.help_platform_index import HelpPlatformIndexView
from sentry.web.frontend.mailgun_inbound_webhook import MailgunInboundWebhookView
from sentry.web.frontend.organization_audit_log import OrganizationAuditLogView
from sentry.web.frontend.organization_home import OrganizationHomeView
from sentry.web.frontend.organization_members import OrganizationMembersView
from sentry.web.frontend.organization_member_settings import OrganizationMemberSettingsView
from sentry.web.frontend.organization_stats import OrganizationStatsView
from sentry.web.frontend.organization_settings import OrganizationSettingsView
from sentry.web.frontend.create_organization import CreateOrganizationView
from sentry.web.frontend.create_organization_member import CreateOrganizationMemberView
from sentry.web.frontend.create_project import CreateProjectView
from sentry.web.frontend.create_team import CreateTeamView
from sentry.web.frontend.project_settings import ProjectSettingsView
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

    urlpatterns += patterns('',
        url(r'^debug/mail/new-event/$',
            sentry.web.frontend.debug.mail.new_event),
        url(r'^debug/mail/new-note/$',
            sentry.web.frontend.debug.mail.new_note),
    )

urlpatterns += patterns('',
    # Store endpoints first since they are the most active
    url(r'^api/store/$', api.StoreView.as_view(),
        name='sentry-api-store'),
    url(r'^api/(?P<project_id>[\w_-]+)/store/$', api.StoreView.as_view(),
        name='sentry-api-store'),

    url(r'^_static/(?P<module>[^/]+)/(?P<path>.*)$', generic.static_media,
        name='sentry-media'),

    # API
    url(r'^api/0/', include('sentry.api.urls')),
    url(r'^api/hooks/mailgun/inbound/', MailgunInboundWebhookView.as_view(),
        name='sentry-mailgun-inbound-hook'),

    # Account
    url(r'^login/$', AuthLoginView.as_view(),
        name='sentry-login'),
    url(r'^login-redirect/$', accounts.login_redirect,
        name='sentry-login-redirect'),
    url(r'^logout/$', AuthLogoutView.as_view(),
        name='sentry-logout'),
    url(r'^register/$', accounts.register,
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
    url(r'^account/settings/social/', include('social_auth.urls')),

    # Help
    url(r'^docs/$', HelpIndexView.as_view(),
        name='sentry-help'),
    url(r'^docs/api/', include('sentry.api.help_urls')),
    url(r'^docs/(?P<page_id>[\d]+)/(?P<page_slug>[^\/]+)/$', HelpPageView.as_view(),
        name='sentry-help-page'),
    url(r'^docs/platforms/$', HelpPlatformIndexView.as_view(),
        name='sentry-help-platform-list'),
    url(r'^docs/platforms/(?P<platform>[^\/]+)/$', HelpPlatformDetailsView.as_view(),
        name='sentry-help-platform'),

    # Organizations
    url(r'^(?P<organization_slug>[\w_-]+)/$', OrganizationHomeView.as_view(),
        name='sentry-organization-home'),
    url(r'^organizations/new/$', CreateOrganizationView.as_view(),
        name='sentry-create-organization'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/access-groups/$', AccessGroupMigrationView.as_view(),
        name='sentry-organization-access-group-migration'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/audit-log/$', OrganizationAuditLogView.as_view(),
        name='sentry-organization-audit-log'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/$', OrganizationMembersView.as_view(),
        name='sentry-organization-members'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/new/$', CreateOrganizationMemberView.as_view(),
        name='sentry-create-organization-member'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/(?P<member_id>\d+)/$', OrganizationMemberSettingsView.as_view(),
        name='sentry-organization-member-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/stats/$', OrganizationStatsView.as_view(),
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
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/get-started/$',
        sentry.web.frontend.projects.general.get_started,
        name='sentry-get-started'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/$',
        ProjectSettingsView.as_view(),
        name='sentry-manage-project'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/$',
        sentry.web.frontend.projects.keys.manage_project_keys,
        name='sentry-manage-project-keys'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/new/$',
        sentry.web.frontend.projects.keys.new_project_key,
        name='sentry-new-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/(?P<key_id>\d+)/edit/$',
        sentry.web.frontend.projects.keys.edit_project_key,
        name='sentry-edit-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/(?P<key_id>\d+)/remove/$',
        sentry.web.frontend.projects.keys.remove_project_key,
        name='sentry-remove-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/(?P<key_id>\d+)/disable/$',
        sentry.web.frontend.projects.keys.disable_project_key,
        name='sentry-disable-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/(?P<key_id>\d+)/enable/$',
        sentry.web.frontend.projects.keys.enable_project_key,
        name='sentry-enable-project-key'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/$',
        sentry.web.frontend.projects.plugins.manage_plugins,
        name='sentry-manage-project-plugins'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/$',
        sentry.web.frontend.projects.plugins.configure_project_plugin,
        name='sentry-configure-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/reset/$',
        sentry.web.frontend.projects.plugins.reset_project_plugin,
        name='sentry-reset-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/disable/$',
        sentry.web.frontend.projects.plugins.disable_project_plugin,
        name='sentry-disable-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/enable/$',
        sentry.web.frontend.projects.plugins.enable_project_plugin,
        name='sentry-enable-project-plugin'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/remove/$',
        RemoveProjectView.as_view(),
        name='sentry-remove-project'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/tags/$',
        sentry.web.frontend.projects.tags.manage_project_tags,
        name='sentry-manage-project-tags'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/quotas/$',
        sentry.web.frontend.projects.quotas.manage_project_quotas,
        name='sentry-manage-project-quotas'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/notifications/$',
        sentry.web.frontend.projects.notifications.notification_settings,
        name='sentry-project-notifications'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/rules/$',
        sentry.web.frontend.projects.rules.list_rules,
        name='sentry-project-rules'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/rules/(?P<rule_id>\d+)/edit/$',
        sentry.web.frontend.projects.rules.create_or_edit_rule,
        name='sentry-edit-project-rule'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/rules/(?P<rule_id>\d+)/remove/$',
        sentry.web.frontend.projects.rules.remove_rule,
        name='sentry-remove-project-rule'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/rules/new/$',
        sentry.web.frontend.projects.rules.create_or_edit_rule,
        name='sentry-new-project-rule'),

    # Generic
    url(r'^$', HomeView.as_view(),
        name='sentry'),

    # Admin
    url(r'^manage/status/$', admin.status_env,
        name='sentry-admin-status'),
    url(r'^manage/status/packages/$', admin.status_packages,
        name='sentry-admin-packages-status'),
    url(r'^manage/status/mail/$', admin.status_mail,
        name='sentry-admin-mail-status'),
    url(r'^manage/stats/$', admin.stats,
        name='sentry-admin-stats'),

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

    # crossdomain.xml
    url(r'^crossdomain\.xml$', api.crossdomain_xml_index,
        name='sentry-api-crossdomain-xml-index'),
    url(r'^api/(?P<project_id>[\w_-]+)/crossdomain\.xml$', api.crossdomain_xml,
        name='sentry-api-crossdomain-xml'),

    # Generic API
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/poll/$', api.poll,
        name='sentry-api-poll'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/resolve/$', api.resolve,
        name='sentry-api-resolve'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/bookmark/$', api.bookmark,
        name='sentry-api-bookmark'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/clear/$', api.clear,
        name='sentry-api-clear'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/remove/$', api.remove_group,
        name='sentry-api-remove-group'),

    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<team_slug>[\w_-]+)/groups/trends/$', api.get_group_trends,
        name='sentry-api-groups-trends'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<team_slug>[\w_-]+)/groups/newest/$', api.get_new_groups,
        name='sentry-api-groups-new'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<team_slug>[\w_-]+)/groups/resolved/$', api.get_resolved_groups,
        name='sentry-api-groups-resolved'),

    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/public/$', api.make_group_public,
        name='sentry-api-set-group-public'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/private/$', api.make_group_private, name='sentry-api-set-group-private'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/resolved/$', api.resolve_group,
        name='sentry-api-set-group-resolve'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/muted/$', api.mute_group,
        name='sentry-api-set-group-mute'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/unresolved/$', api.unresolve_group,
        name='sentry-api-set-group-unresolve'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/tags/(?P<tag_name>[^/]+)/$', api.get_group_tags,
        name='sentry-api-group-tags'),

    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<team_slug>[\w_-]+)/stats/$', api.get_stats,
        name='sentry-api-stats'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/tags/search/$', api.search_tags,
        name='sentry-api-search-tags'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/users/search/$', api.search_users,
        name='sentry-api-search-users'),
    url(r'^api/(?P<organization_slug>[\w_-]+)/projects/search/$', api.search_projects,
        name='sentry-api-search-projects'),

    # TV dashboard
    url(r'^(?P<organization_slug>[\w_-]+)/teams/(?P<team_slug>[\w_-]+)/wall/$', groups.wall_display,
        name='sentry-wall'),

    # Team-wide alerts
    url(r'^(?P<organization_slug>[\w_-]+)/teams/(?P<team_slug>[\w_-]+)/show/alerts/$', alerts.alert_list,
        name='sentry-alerts'),

    # Explore - Users
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/users/$',
        users.user_list, name='sentry-users'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/users/(?P<user_id>\d+)/$',
        users.user_details, name='sentry-user-details'),

    # Explore - Code
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/code/$', explore_code.list_tag,
        {'selection': 'filenames'}, name='sentry-explore-code'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/code/by/function/$', explore_code.list_tag,
        {'selection': 'functions'}, name='sentry-explore-code-by-function'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/code/by/filename/(?P<tag_id>\d+)/$',
        explore_code.tag_details, {'selection': 'filenames'}, name='sentry-explore-code-details'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/code/by/function/(?P<tag_id>\d+)/$',
        explore_code.tag_details, {'selection': 'functions'}, name='sentry-explore-code-details-by-function'),

    # Explore
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/$', explore.tag_list,
        name='sentry-explore'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/(?P<key>[^\/]+)/$', explore.tag_value_list,
        name='sentry-explore-tag'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/explore/(?P<key>[^\/]+)/(?P<value_id>\d+)/$', explore.tag_value_details,
        name='sentry-explore-tag-value'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/$', groups.group,
        name='sentry-group'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/$', groups.group_event_list,
        name='sentry-group-events'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id>\d+)/$', groups.group,
        name='sentry-group-event'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id>\d+)/replay/$', events.replay_event,
        name='sentry-replay'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id_or_latest>(\d+|latest))/json/$', groups.group_event_details_json,
        name='sentry-group-event-json'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)/', groups.group_plugin_action,
        name='sentry-group-plugin-action'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/tags/$', groups.group_tag_list,
        name='sentry-group-tags'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/tags/(?P<tag_name>[^/]+)/$', groups.group_tag_details,
        name='sentry-group-tag-details'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/alerts/$', alerts.alert_list,
        name='sentry-alerts'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/alerts/(?P<alert_id>\d+)/$', alerts.alert_details,
        name='sentry-alert-details'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/alerts/(?P<alert_id>\d+)/resolve/$', alerts.resolve_alert,
        name='sentry-resolve-alert'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/stream/$', groups.group_list),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/$', groups.group_list,
        name='sentry-stream'),

    url(r'^(?P<organization_slug>[\w_-]+)/teams/(?P<team_slug>[\w_-]+)/$', groups.dashboard,
        name='sentry-team-dashboard'),

    # Legacy
    url(r'^(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/$', groups.redirect_to_group,
        name='sentry-group'),
)
