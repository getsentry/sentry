import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useTeams} from 'sentry/utils/useTeams';
import {UnassignedBadge} from 'sentry/views/alerts/list/util';

import type {Template} from './index';

function AlertTemplateCard({template}: {template: Template}) {
  const {teams} = useTeams();

  const {name, owner} = template;
  const ownerId = owner && owner.split(':')[1];
  const ownerTeam = teams.find(team => team.id === ownerId);

  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: t('Edit'),
      // to: editLink,
    },
    {
      key: 'duplicate',
      label: t('Duplicate'),
      // to: duplicateLink,
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      onAction: () => {
        openConfirmModal({
          onConfirm: () => {},
          header: <h5>{t('Delete Alert Procedure?')}</h5>,
          message: tct(
            "Are you sure you want to delete '[label]'? All it's associated data will be removed. Alerts/Templates which use this procedure will not be affected.",
            {label}
          ),
          confirmText: t('Delete Alert Procedure'),
          priority: 'danger',
        });
      },
    },
  ];

  return (
    <StyledCard interactive>
      <Title>{name}</Title>
      <Subtitle>This is the content of a subtitle</Subtitle>
      <BadgeArea>
        {/* TODO(Leander): Use the real team */}
        {ownerTeam ? <TeamBadge team={ownerTeam} /> : <UnassignedBadge />}
        <StyledDropdown
          items={actions}
          position="bottom-end"
          triggerProps={{
            'aria-label': t('Actions'),
            size: 'xs',
            icon: <IconEllipsis size="xs" />,
            showChevron: false,
          }}
        />
      </BadgeArea>
      <Summary>test</Summary>
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  padding: 1rem;
  margin: 0;
  display: grid;
  grid-column-gap: ${space(2)};
  grid-template: 1fr 1fr auto / 1fr auto;
`;

const Title = styled('div')`
  grid-area: 1 / 1 / 2 / 2;
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
`;

const Subtitle = styled('div')`
  grid-area: 2 / 1 / 3 / 2;
  font-size: 0.9rem;
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const BadgeArea = styled('div')`
  grid-area: 1 / 2 / 3 / 3;
  display: flex;
`;

const Summary = styled('div')`
  grid-area: 3 / 1 / 4 / 3;
`;

const StyledDropdown = styled(DropdownMenu)`
  display: flex;
  align-items: center;
  margin-left: 1rem;
`;

export default AlertTemplateCard;
