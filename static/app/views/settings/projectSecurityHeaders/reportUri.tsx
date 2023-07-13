import FieldGroup from 'sentry/components/forms/fieldGroup';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TextCopyInput from 'sentry/components/textCopyInput';
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
        <FieldGroup inline={false} flexibleControlStateSize>
          <TextCopyInput>{getSecurityDsn(keyList)}</TextCopyInput>
        </FieldGroup>
      </PanelBody>
    </Panel>
  );
}
