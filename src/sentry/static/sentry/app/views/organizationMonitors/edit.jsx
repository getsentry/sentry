import React from 'react';
import PropTypes from 'prop-types';

import Access from 'app/components/acl/access';
import AsyncView from 'app/views/asyncView';
import DateTime from 'app/components/dateTime';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import TextField from 'app/views/settings/components/forms/textField';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import withOrganization from 'app/utils/withOrganization';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';

import MonitorHeader from './monitorHeader';

class EditMonitor extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  static propTypes = {
    location: PropTypes.object.isRequired,
    ...AsyncView.propTypes,
  };

  getEndpoints() {
    const {params, location} = this.props;
    return [
      [
        'monitor',
        `/monitors/${params.monitorId}/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    if (this.state.monitor)
      return `${this.state.monitor.name} - Monitors - ${this.props.params.orgId}`;
    return `Monitors - ${this.props.params.orgId}`;
  }

  renderBody() {
    const {monitor} = this.state;
    return (
      <React.Fragment>
        <MonitorHeader monitor={monitor} />

        <Access access={['project:write']}>
          {({hasAccess}) => (
            <React.Fragment>
              <Form
                saveOnBlur
                allowUndo
                apiEndpoint={`/monitors/${monitor.id}/`}
                apiMethod="PUT"
                initialData={{
                  name: monitor.name,
                }}
              >
                <Panel>
                  <PanelHeader>{t('Details')}</PanelHeader>

                  <PanelBody>
                    <Field label={t('ID')}>
                      <div className="controls">
                        <TextCopyInput>{monitor.id}</TextCopyInput>
                      </div>
                    </Field>
                    <TextField
                      name="name"
                      label={t('Name')}
                      disabled={!hasAccess}
                      required={false}
                    />
                    <Field label={t('Last Check-in')}>
                      <div className="controls">
                        <DateTime date={monitor.lastCheckIn} />
                      </div>
                    </Field>
                    <Field label={t('Next Check-in (expected)')}>
                      <div className="controls">
                        <DateTime date={monitor.nextCheckIn} />
                      </div>
                    </Field>
                    <Field label={t('Created')}>
                      <div className="controls">
                        <DateTime date={monitor.dateCreated} />
                      </div>
                    </Field>
                  </PanelBody>
                </Panel>
              </Form>
            </React.Fragment>
          )}
        </Access>
      </React.Fragment>
    );
  }
}

export default withOrganization(EditMonitor);
