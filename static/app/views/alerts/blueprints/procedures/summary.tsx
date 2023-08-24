import {Fragment} from 'react';
import styled from '@emotion/styled';

import {IconArrow, IconFire} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import AccordionRow from 'sentry/views/alerts/blueprints/accordionRow';
import {AlertProcedure} from 'sentry/views/alerts/blueprints/types';
import {getActionIcon} from 'sentry/views/alerts/blueprints/util';
import {TextAction} from 'sentry/views/alerts/rules/issue/details/textRule';

function AlertProcedureSummary({procedure}: {procedure: AlertProcedure}) {
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

export const ActionTitle = styled('div')`
  display: flex;
  align-items: center;
  * {
    margin: 0 0.2rem;
  }
`;
export const ActionTextContainer = styled('div')`
  padding: ${space(0.5)};
`;

export const ActionText = styled('div')`
  display: grid;
  grid-template-columns: 20px 1fr;
  align-items: center;
  gap: ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)};
  margin: ${space(0.75)} 0;
  background: ${p => p.theme.surface200};
`;

export default AlertProcedureSummary;
