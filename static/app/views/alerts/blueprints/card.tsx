import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useTeams} from 'sentry/utils/useTeams';
import {UnassignedBadge} from 'sentry/views/alerts/blueprints/util';

export interface AlertBlueprintCardProps {
  actions: MenuItemProps[];
  description: string | null;
  owner: string | null;
  title: string;
}

function AlertBlueprintCard({
  owner,
  title,
  description,
  actions,
  children,
}: React.PropsWithChildren<AlertBlueprintCardProps>) {
  const {teams} = useTeams();

  const ownerId = owner && owner.split(':')[1];
  const ownerTeam = teams.find(team => team.id === ownerId);

  return (
    <StyledCard>
      <AlertBlueprintTitle>{title}</AlertBlueprintTitle>
      <AlertBlueprintDescription>{description}</AlertBlueprintDescription>
      <BadgeArea>
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
      <Summary>{children}</Summary>
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  padding: 1rem;
  margin: 0;
  display: grid;
  column-gap: ${space(2)};
  row-gap: ${space(1)};
  grid-template: auto 1fr auto / 1fr auto;
  align-items: center;
  &:focus,
  &:hover {
    box-shadow: 0px 0px 0px 6px rgba(209, 202, 216, 0.2);
    outline: none;
  }

  &:active {
    box-shadow: 0px 0px 0px 6px rgba(209, 202, 216, 0.5);
  }
`;

const AlertBlueprintTitle = styled('div')`
  grid-area: 1 / 1 / 2 / 2;
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
`;

const AlertBlueprintDescription = styled('div')`
  grid-area: 2 / 1 / 3 / 3;
  font-size: 0.9rem;
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const BadgeArea = styled('div')`
  grid-area: 1 / 2 / 2 / 3;
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

export default AlertBlueprintCard;
