import styled from '@emotion/styled';

import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import Button, {ButtonPropsWithoutAriaLabel} from '../button';

interface ExportProfileButtonProps
  extends Omit<ButtonPropsWithoutAriaLabel, 'onClick' | 'children'> {
  eventId: string | undefined;
  orgId: string | undefined;
  projectId: string | undefined;
}

export function ExportProfileButton(props: ExportProfileButtonProps) {
  const api = useApi();
  const organization = useOrganization();

  const project = useProjects().projects.find(p => {
    return p.slug === props.projectId;
  });

  return (
    <StyledButton
      {...props}
      size="xs"
      title={t('Export Profile')}
      href={`${api.baseUrl}/projects/${props.orgId}/${props.projectId}/profiling/raw_profiles/${props.eventId}/`}
      download={`${organization.slug}_${
        project?.slug ?? props.projectId ?? 'unknown_project'
      }_${props.eventId}.profile.json`}
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
  padding: ${space(0.5)} ${space(0.5)};

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
  }
`;
