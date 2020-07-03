import $ from 'jquery';
import React from 'react';

import {t} from 'app/locale';
import {CSRF_COOKIE_NAME} from 'app/constants';
import AsyncView from 'app/views/asyncView';
import NarrowLayout from 'app/components/narrowLayout';
import {Form, SelectField} from 'app/components/forms';
import getCookie from 'app/utils/getCookie';

export default class VSTSOrganizationLink extends AsyncView {
  getEndpoints() {
    return [['organizations', '/organizations/']];
  }

  getTitle() {
    return 'Link Organization to VSTS';
  }

  getDefaultState() {
    return {
      organizations: [],
    };
  }

  get targetId() {
    return this.props.location.query.targetId;
  }

  get targetName() {
    return this.props.location.query.targetName;
  }

  get organizations() {
    return this.state.organizations.map(o => [o.slug, o.name]);
  }

  get defaultChoice() {
    return !!this.organizations[0] ? this.organizations[0][0] : '';
  }

  onSubmit() {
    // Because Form can't also just be a normal form.
    const form = $('.link-org-form');
    form.attr('method', 'POST');
    form.attr('action', '/extensions/vsts/configure/');
    form.submit();
  }

  render() {
    return (
      <NarrowLayout>
        <Form
          className="link-org-form"
          submitLabel={t('Continue')}
          onSubmit={this.onSubmit}
        >
          <input
            type="hidden"
            name="csrfmiddlewaretoken"
            value={getCookie(CSRF_COOKIE_NAME)}
          />

          <input type="hidden" name="vsts_id" value={this.targetId} />
          <input type="hidden" name="vsts_name" value={this.targetName} />

          <SelectField
            deprecatedSelectControl
            choices={this.organizations}
            clearable={false}
            value={this.defaultChoice}
            name="organization"
            label={t('Organization to use with Azure DevOps')}
          />
        </Form>
      </NarrowLayout>
    );
  }
}
