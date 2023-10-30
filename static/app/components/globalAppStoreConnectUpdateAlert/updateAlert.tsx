import {useContext} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';

type Props = {
  Wrapper?: React.ComponentType;
  className?: string;
  project?: Project;
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
          <NoMarginBottomAlert key={key} type="warning" showIcon>
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
  gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const NoMarginBottomAlert = styled(Alert)`
  margin-bottom: 0;
`;

const AlertContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
`;
