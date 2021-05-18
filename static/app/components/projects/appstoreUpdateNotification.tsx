import {useContext} from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {IconUpgrade} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import AppStoreConnectContext, {
  Provider as AppStoreProvider,
} from 'app/views/settings/project/appStoreConnectContext';

type Props = {
  organization: Organization;
  project: Project;
  inEventToolbar?: boolean;
};

const ONE_WEEK = 7 * 24 * 3600 * 1000;

const StyledAlert = styled(Alert)`
  margin: 0;
  margin-top: ${space(0.5)};
`;

const AppStoreUpdateNotificationInner = ({inEventToolbar = false}: Props) => {
  const validity = useContext(AppStoreConnectContext);
  if (!validity) {
    return null;
  }

  const isValid = validity.appstoreCredentialsValid && validity.itunesSessionValid;
  let expiresSoon = false;
  if (validity.expirationDate) {
    const expires = new Date(validity.expirationDate);
    expiresSoon = Date.now() > expires.getTime() - ONE_WEEK;
  }

  if (isValid && !expiresSoon) {
    return null;
  }

  const msg = !isValid
    ? t('Your AppStore Connect Credentials have expired.')
    : t('Your AppStore Connect Credentials will expire soon.');

  const AlertComponent = inEventToolbar ? StyledAlert : Alert;
  return (
    <AlertComponent type="info" icon={<IconUpgrade size="sm" />}>
      <AlertContent>
        {msg}
        {/*TODO: Deep linking to settings page */}

        {/*TODO: Button to dismiss this prompt
        <Button
          priority="link"
          title={t('Dismiss for a week')}
          onClick={this.snoozePrompt}
        >
          <IconClose />
        </Button>*/}
      </AlertContent>
    </AlertComponent>
  );
};

const AppStoreUpdateNotification = (props: Props) => {
  const {project, organization} = props;
  const orgSlug = organization.slug;

  return (
    <AppStoreProvider project={project} orgSlug={orgSlug} cached>
      <AppStoreUpdateNotificationInner {...props} />
    </AppStoreProvider>
  );
};

const AlertContent = styled('div')`
  display: flex;
  flex-wrap: wrap;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    justify-content: space-between;
  }
`;

export default AppStoreUpdateNotification;
