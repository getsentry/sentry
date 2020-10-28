import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router';

import {tct} from 'app/locale';
import Field from 'app/views/settings/components/forms/field';
import getDynamicText from 'app/utils/getDynamicText';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

const DEFAULT_ENDPOINT = 'https://sentry.example.com/api/security-report/';

export const getSecurityDsn = keyList => {
  const endpoint = keyList.length ? keyList[0].dsn.security : DEFAULT_ENDPOINT;
  return getDynamicText({
    value: endpoint,
    fixed: DEFAULT_ENDPOINT,
  });
};

export default class ReportUri extends React.Component {
  static propTypes = {
    keyList: PropTypes.array.isRequired,
  };

  render() {
    const {orgId, projectId} = this.props.params;
    return (
      <Panel>
        <PanelHeader>{'Report URI'}</PanelHeader>
        <PanelBody>
          <PanelAlert type="info">
            {tct(
              "We've automatically pulled these credentials from your available [link:Client Keys]",
              {
                link: <Link to={`/settings/${orgId}/projects/${projectId}/keys/`} />,
              }
            )}
          </PanelAlert>
          <Field inline={false} flexibleControlStateSize>
            <TextCopyInput>{getSecurityDsn(this.props.keyList)}</TextCopyInput>
          </Field>
        </PanelBody>
      </Panel>
    );
  }
}
