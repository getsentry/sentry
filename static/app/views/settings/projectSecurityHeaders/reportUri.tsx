import React from 'react';
import {Link} from 'react-router';

import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {ProjectKey} from 'app/types';
import getDynamicText from 'app/utils/getDynamicText';
import Field from 'app/views/settings/components/forms/field';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

const DEFAULT_ENDPOINT = 'https://sentry.example.com/api/security-report/';

export function getSecurityDsn(keyList: ProjectKey[]) {
  const endpoint = keyList.length ? keyList[0].dsn.security : DEFAULT_ENDPOINT;
  return getDynamicText({
    value: endpoint,
    fixed: DEFAULT_ENDPOINT,
  });
}

type Props = {
  keyList: ProjectKey[];
  orgId: string;
  projectId: string;
};

export default function ReportUri({keyList, orgId, projectId}: Props) {
  return (
    <Panel>
      <PanelHeader>{t('Report URI')}</PanelHeader>
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
          <TextCopyInput>{getSecurityDsn(keyList)}</TextCopyInput>
        </Field>
      </PanelBody>
    </Panel>
  );
}
