import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import Button, {ButtonPropsWithoutAriaLabel} from '../button';

function exportProfile(
  api: Client,
  eventId: string,
  projectId: Project['id'],
  organizationId: Organization['slug']
): Promise<any> {
  return api.requestPromise(
    `/projects/${organizationId}/${projectId}/profiling/profiles/${eventId}/`
  );
}

interface ExportProfileButtonProps
  extends Omit<ButtonPropsWithoutAriaLabel, 'onClick' | 'children'> {
  eventId: string | undefined;
  orgId: string | undefined;
  projectId: string | undefined;
}

export function ExportProfileButton(props: ExportProfileButtonProps) {
  const api = useApi();
  const handleDownload = useCallback(() => {
    if (
      props.eventId === undefined ||
      props.orgId === undefined ||
      props.projectId === undefined
    ) {
      return;
    }

    exportProfile(api, props.eventId, props.projectId, props.orgId);
  }, [api, props.eventId, props.projectId, props.orgId]);

  return (
    <StyledButton
      {...props}
      size="xs"
      title={t('Export Profile')}
      onClick={handleDownload}
    >
      <IconDownload size="xs" />
    </StyledButton>
  );
}

const StyledButton = styled(Button)`
  border: none;
  background-color: transparent;
  box-shadow: none;
  transition: none !important;
  opacity: 0.5;

  &:not(:last-child) {
    margin-right: ${space(1)};
  }

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
  }
`;
