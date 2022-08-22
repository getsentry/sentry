import Field from 'sentry/components/forms/field';
import TextCopyInput from 'sentry/components/forms/textCopyInput';
import Link from 'sentry/components/links/link';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {ProjectKey} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';

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
