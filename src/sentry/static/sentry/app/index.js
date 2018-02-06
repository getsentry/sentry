/* global module */
import jQuery from 'jquery';
import moment from 'moment';
import Raven from 'raven-js';
import React from 'react';
import ReactDOM from 'react-dom';
import createReactClass from 'create-react-class';
import {AppContainer} from 'react-hot-loader';
import PropTypes from 'prop-types';
import {renderToStaticMarkup} from 'react-dom/server';
import Reflux from 'reflux';
import * as Router from 'react-router';
import ReactBootstrapModal from 'react-bootstrap/lib/Modal';
import JsCookie from 'js-cookie';

import './utils/emotion-setup';
import * as api from './api';
import * as il8n from './locale';
import plugins from './plugins';
import Main from './main';

const csrfCookieName = window.csrfCookieName || 'sc';

// setup jquery for CSRF tokens
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    let cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      let cookie = jQuery.trim(cookies[i]);
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) == name + '=') {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function csrfSafeMethod(method) {
  // these HTTP methods do not require CSRF protection
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method);
}

jQuery.ajaxSetup({
  beforeSend: function(xhr, settings) {
    if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
      xhr.setRequestHeader('X-CSRFToken', getCookie(csrfCookieName));
    }
  },
});

// these get exported to a global variable, which is important as its the only
// way we can call into scoped objects

let render = Component => {
  let rootEl = document.getElementById('blk_router');
  ReactDOM.render(
    <AppContainer>
      <Component />
    </AppContainer>,
    rootEl
  );
};

if (module.hot) {
  // webpack 2 has built in support for es2015 modules, so don't have to re-require
  module.hot.accept('./main', () => {
    render(Main);
  });
}

export default {
  jQuery,
  moment,
  Raven,
  React,
  ReactDOM: {
    findDOMNode: ReactDOM.findDOMNode,
    render: ReactDOM.render,
  },
  PropTypes,
  ReactDOMServer: {
    renderToStaticMarkup,
  },
  createReactClass,
  ReactBootstrap: {
    Modal: ReactBootstrapModal,
  },
  Reflux,
  Router,
  JsCookie,
  SentryRenderApp: () => render(Main),

  Sentry: {
    api,
    forms: {
      // we dont yet export all form field classes as they're not
      // all needed by sentry.io
      ApiForm: require('./components/forms/apiForm').default,
      BooleanField: require('./components/forms/booleanField').default,
      EmailField: require('./components/forms/emailField').default,
      Form: require('./components/forms/form').default,
      RangeField: require('./components/forms/rangeField').default,
      Select2Field: require('./components/forms/select2Field').default,
      TextField: require('./components/forms/textField').default,
      TextareaField: require('./components/forms/textareaField').default,
    },
    plugins: {
      add: plugins.add,
      addContext: plugins.addContext,
      BasePlugin: plugins.BasePlugin,
      DefaultIssuePlugin: plugins.DefaultIssuePlugin,
    },

    Alerts: require('./components/alerts').default,
    AlertActions: require('./actions/alertActions').default,
    AsyncComponent: require('./components/asyncComponent').default,
    // TODO: remove when old personal settings are deprecated
    AvatarSettings: require('./components/avatarSettings').default,
    Button: require('./components/buttons/button').default,
    mixins: {
      ApiMixin: require('./mixins/apiMixin').default,
      TooltipMixin: require('./mixins/tooltip').default,
    },
    BarChart: require('./components/barChart').default,
    i18n: il8n,
    ConfigStore: require('./stores/configStore').default,
    Count: require('./components/count').default,
    DateTime: require('./components/dateTime').default,
    DropdownLink: require('./components/dropdownLink').default,
    DynamicWrapper: require('./components/dynamicWrapper').default,
    Form: require('./components/forms/form').default,
    FormState: require('./components/forms/index').FormState,
    HookStore: require('./stores/hookStore').default,
    Indicators: require('./components/indicators').default,
    IndicatorStore: require('./stores/indicatorStore').default,
    InviteMember: require('./views/inviteMember/inviteMember').default,
    LoadingError: require('./components/loadingError').default,
    LoadingIndicator: require('./components/loadingIndicator').default,
    ListLink: require('./components/listLink').default,
    MenuItem: require('./components/menuItem').default,
    NarrowLayout: require('./components/narrowLayout').default,
    OrganizationHomeContainer: require('./components/organizations/homeContainer')
      .default,
    OrganizationsLoader: require('./components/organizations/organizationsLoader')
      .default,
    OrganizationMembersView: require('./views/settings/organization/members/organizationMembersView')
      .default,
    Panel: require('./views/settings/components/panel').default,
    PanelHeader: require('./views/settings/components/panelHeader').default,
    PanelBody: require('./views/settings/components/panelBody').default,
    PanelItem: require('./views/settings/components/panelItem').default,
    Pagination: require('./components/pagination').default,
    PluginConfig: require('./components/pluginConfig').default,
    ProjectIssueTracking: require('./views/projectIssueTracking').default,
    ProjectSelector: require('./components/projectHeader/projectSelector').default,
    SettingsPageHeader: require('./views/settings/components/settingsPageHeader').default,
    Sidebar: require('./components/sidebar').default,
    StackedBarChart: require('./components/stackedBarChart').default,
    TextBlock: require('./views/settings/components/text/textBlock').default,
    TimeSince: require('./components/timeSince').default,
    TodoList: require('./components/onboardingWizard/todos').default,
    U2fEnrollment: require('./components/u2fenrollment').default,
    U2fSign: require('./components/u2fsign').default,
    Badge: require('./components/badge').default,
    Switch: require('./components/switch').default,
    GlobalModal: require('./components/globalModal').default,
    SetupWizard: require('./components/setupWizard').default,
    utils: {
      errorHandler: require('./utils/errorHandler').default,
      logging: require('./utils/logging'),
    },
  },
};
