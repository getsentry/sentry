import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router';

import {tct} from '../../../locale';
import AsyncView from '../../asyncView';
import Field from '../components/forms/field';
import getDynamicText from '../../../utils/getDynamicText';
import {Panel, PanelAlert, PanelBody, PanelHeader} from '../../../components/panels';
import TextCopyInput from '../components/forms/textCopyInput';

const DEFAULT_ENDPOINT = 'https://sentry.example.com/api/security-report/';

export const getSecurityDsn = keyList => {
  let endpoint = keyList.length ? keyList[0].dsn.security : DEFAULT_ENDPOINT;
  return getDynamicText({
    value: endpoint,
    fixed: DEFAULT_ENDPOINT,
  });
};

export default class ReportUri extends AsyncView {
  static propTypes = {
    keyList: PropTypes.array.isRequired,
  };

  getEndpoints() {
    return [];
  }

  render() {
    let {orgId, projectId} = this.props.params;
    return (
      <Panel>
        <PanelHeader>{'Report URI'}</PanelHeader>
        <PanelBody>
          <PanelAlert type="info">
            {tct(
              "We've automatically pulled these credentials from your available [link:Client Keys]",
              {
                link: <Link to={`/settings/${orgId}/${projectId}/keys/`} />,
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
