import {useContext} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {IconRefresh} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';

type Props = {
  organization: Organization;
  project?: Project;
  Wrapper?: React.ComponentType;
  isCompact?: boolean;
  className?: string;
};

function UpdateAlert({Wrapper, project, className}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  if (
    !project ||
    !appStoreConnectContext ||
    !Object.keys(appStoreConnectContext).some(
      key => !!appStoreConnectContext[key].updateAlertMessage
    )
  ) {
    return null;
  }

  const notices = (
    <Notices className={className}>
      {Object.keys(appStoreConnectContext).map(key => {
        const {updateAlertMessage} = appStoreConnectContext[key];
        if (!updateAlertMessage) {
          return null;
        }

        return (
          <NoMarginBottomAlert key={key} type="warning" icon={<IconRefresh />}>
            <AlertContent>{updateAlertMessage}</AlertContent>
          </NoMarginBottomAlert>
        );
      })}
    </Notices>
  );

  return Wrapper ? <Wrapper>{notices}</Wrapper> : notices;
}

export default UpdateAlert;

const Notices = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const NoMarginBottomAlert = styled(Alert)`
  margin-bottom: 0;
`;

const AlertContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1)};
`;
