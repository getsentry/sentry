import {Fragment} from 'react';
import styled from '@emotion/styled';

import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Card from 'sentry/components/card';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import {IconArrow, IconEllipsis, IconFire} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useTeams} from 'sentry/utils/useTeams';
import AccordionRow from 'sentry/views/alerts/list/procedures/accordionRow';
import {getActionIcon} from 'sentry/views/alerts/list/util';
import {TextAction} from 'sentry/views/alerts/rules/issue/details/textRule';

import type {Procedure} from './index';

function AlertProcedureCard({procedure}: {procedure: Procedure}) {
  const {label} = procedure;
  const {teams} = useTeams();

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
            "Are you sure you want to delete '[label]'? All it's associated data will be removed. Alerts which use this procedure will not be affected.",
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
      <Title>{label}</Title>
      <Subtitle>This is the content of a subtitle</Subtitle>
      <BadgeArea>
        {/* TODO(Leander): Use the real team */}
        <TeamBadge team={teams[0]} />
        <StyledDropdown
          items={actions}
          position="bottom-end"
          triggerProps={{
            'aria-label': t('Actions'),
            size: 'xs',
            icon: <IconEllipsis size="xs" />,
            showChevron: false,
          }}
        >
          <MenuItemActionLink shouldConfirm={false}>{t('Edit')}</MenuItemActionLink>
          <MenuItemActionLink shouldConfirm>{t('Delete')}</MenuItemActionLink>
        </StyledDropdown>
      </BadgeArea>
      <Summary>
        <AlertProcedureSummary procedure={procedure} />
      </Summary>
    </StyledCard>
  );
}

function AlertProcedureSummary({procedure}: {procedure: Procedure}) {
  const {issue_alert_actions: actions = []} = procedure;
  const titleComponent = (
    <ActionTitle>
      <IconFire size="sm" color="dangerText" />
      <IconArrow direction="right" size="xs" />
      {actions.map((a, i) => {
        return i !== actions.length - 1 ? (
          <Fragment>
            {getActionIcon(a)}
            <IconArrow direction="right" size="xs" />
          </Fragment>
        ) : (
          getActionIcon(a)
        );
      })}
    </ActionTitle>
  );
  return (
    <AccordionRow
      title={titleComponent}
      body={
        <ActionTextContainer>
          {actions.map((a, i) => (
            <ActionText key={i}>
              {getActionIcon(a)}
              <TextAction action={a} memberList={[]} teams={[]} />
            </ActionText>
          ))}
        </ActionTextContainer>
      }
    />
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

const ActionTitle = styled('div')`
  display: flex;
  align-items: center;
  * {
    margin: 0 0.2rem;
  }
`;
const ActionTextContainer = styled('div')`
  padding: ${space(0.5)};
`;

const ActionText = styled('div')`
  display: grid;
  grid-template-columns: 20px 1fr;
  align-items: center;
  gap: ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)};
  margin: ${space(0.75)} 0;
  background: ${p => p.theme.surface200};
`;

const StyledDropdown = styled(DropdownMenu)`
  display: flex;
  align-items: center;
  margin-left: 1rem;
`;

export default AlertProcedureCard;
