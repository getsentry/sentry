/* global module */
import {AppContainer} from 'react-hot-loader';
import {renderToStaticMarkup} from 'react-dom/server';
import * as Emotion from 'emotion';
import * as EmotionTheming from 'emotion-theming';
import * as GridEmotion from 'grid-emotion';
import JsCookie from 'js-cookie';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import React from 'react';
import ReactBootstrapModal from 'react-bootstrap/lib/Modal';
import ReactDOM from 'react-dom';
import * as ReactEmotion from 'react-emotion';
import Reflux from 'reflux';
import * as Router from 'react-router';
import createReactClass from 'create-react-class';
import jQuery from 'jquery';
import moment from 'moment';

import 'app/utils/emotion-setup';

import Main from 'app/main';
import * as api from 'app/api';
import ajaxCsrfSetup from 'app/utils/ajaxCsrfSetup';
import * as il8n from 'app/locale';
import plugins from 'app/plugins';

// setup jquery for CSRF tokens
jQuery.ajaxSetup({
  //jQuery won't allow using the ajaxCsrfSetup function directly
  beforeSend: ajaxCsrfSetup,
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
  Emotion,
  EmotionTheming,
  ReactEmotion,
  GridEmotion,

  SentryRenderApp: () => render(Main),

  SentryApp: {
    api,
    forms: {
      // we dont yet export all form field classes as they're not
      // all needed by sentry.io
      ApiForm: require('app/components/forms/apiForm').default,
      BooleanField: require('app/components/forms/booleanField').default,
      DateTimeField: require('app/components/forms/dateTimeField').default,
      EmailField: require('app/components/forms/emailField').default,
      Form: require('app/components/forms/form').default,
      RadioBooleanField: require('app/components/forms/radioBooleanField').default,
      RangeField: require('app/components/forms/rangeField').default,
      SelectField: require('app/components/forms/selectField').default,
      // TODO(billy): Remove this after getsentry is merged/updated #SELECT2
      Select2Field: require('app/components/forms/selectField').default,
      TextField: require('app/components/forms/textField').default,
      TextareaField: require('app/components/forms/textareaField').default,
    },
    plugins: {
      add: plugins.add,
      addContext: plugins.addContext,
      BasePlugin: plugins.BasePlugin,
      DefaultIssuePlugin: plugins.DefaultIssuePlugin,
    },

    Alerts: require('app/components/alerts').default,
    AlertActions: require('app/actions/alertActions').default,
    AsyncComponent: require('app/components/asyncComponent').default,
    AsyncView: require('app/views/asyncView').default,
    Button: require('app/components/buttons/button').default,
    mixins: {
      ApiMixin: require('app/mixins/apiMixin').default,
      TooltipMixin: require('app/mixins/tooltip').default,
    },
    BarChart: require('app/components/barChart').default,
    i18n: il8n,
    ConfigStore: require('app/stores/configStore').default,
    Confirm: require('app/components/confirm').default,
    Count: require('app/components/count').default,
    DateTime: require('app/components/dateTime').default,
    DropdownLink: require('app/components/dropdownLink').default,
    DynamicWrapper: require('app/components/dynamicWrapper').default,
    ErrorBoundary: require('app/components/errorBoundary').default,
    Form: require('app/components/forms/form').default,
    FormState: require('app/components/forms/index').FormState,
    GuideAnchor: require('app/components/assistant/guideAnchor').default,
    HookStore: require('app/stores/hookStore').default,
    Indicators: require('app/components/indicators').default,
    IndicatorStore: require('app/stores/indicatorStore').default,
    InviteMember: require('app/views/settings/organizationMembers/inviteMember').default,
    LoadingError: require('app/components/loadingError').default,
    LoadingIndicator: require('app/components/loadingIndicator').default,
    ListLink: require('app/components/listLink').default,
    MenuItem: require('app/components/menuItem').default,
    NarrowLayout: require('app/components/narrowLayout').default,
    OrganizationAuth: require('app/views/settings/organizationAuth').default,
    OrganizationHomeContainer: require('app/components/organizations/homeContainer')
      .default,
    OrganizationsLoader: require('app/components/organizations/organizationsLoader')
      .default,
    OrganizationMembersView: require('app/views/settings/organizationMembers').default,
    Panel: require('app/components/panels/panel').default,
    PanelHeader: require('app/components/panels/panelHeader').default,
    PanelBody: require('app/components/panels/panelBody').default,
    PanelItem: require('app/components/panels/panelItem').default,
    Pagination: require('app/components/pagination').default,
    PluginConfig: require('app/components/pluginConfig').default,
    ProjectIssueTracking: require('app/views/projectIssueTracking').default,
    ProjectSelector: require('app/components/projectHeader/projectSelector').default,
    SettingsPageHeader: require('app/views/settings/components/settingsPageHeader')
      .default,

    Sidebar: require('app/components/sidebar').default,
    StackedBarChart: require('app/components/stackedBarChart').default,
    TextBlock: require('app/views/settings/components/text/textBlock').default,
    TimeSince: require('app/components/timeSince').default,
    TodoList: require('app/components/onboardingWizard/todos').default,
    Tooltip: require('app/components/tooltip').default,
    U2fEnrollment: require('app/components/u2fenrollment').default,
    U2fSign: require('app/components/u2fsign').default,
    Badge: require('app/components/badge').default,
    Switch: require('app/components/switch').default,
    GlobalModal: require('app/components/globalModal').default,
    SetupWizard: require('app/components/setupWizard').default,
    theme: require('app/utils/theme').default,
    utils: {
      errorHandler: require('app/utils/errorHandler').default,
      ajaxCsrfSetup: require('app/utils/ajaxCsrfSetup').default,
      logging: require('app/utils/logging'),
    },
  },
};
