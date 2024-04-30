import {css} from '@emotion/react';
import styled from '@emotion/styled';

import CollapsePanel from 'sentry/components/collapsePanel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import MetricAlertActivity from 'sentry/views/alerts/rules/metric/details/metricActivity';
import type {AlertRuleActivation, Incident} from 'sentry/views/alerts/types';

const COLLAPSE_COUNT = 3;

type Props = {
  activations?: AlertRuleActivation[];
  incidents?: Incident[];
};

function MetricHistory({incidents, activations}: Props) {
  const organization = useOrganization();
  const filteredIncidents = (incidents ?? []).filter(
    incident => incident.activities?.length
  );
  const numOfIncidents = filteredIncidents.length;

  console.log('filteredIncidents: ', filteredIncidents);
  console.log('ACTIVATIONS: ', activations);

  // TODO: compile number of 'groups'/'bundles'/items?
  // collapsable IF bundles is over?
  // Create a weighted num or something
  // Wait - we're now just adding to the description of the incident trigger
  // IF NO incident, then lets just toss a grayed "activation created"? (or do this anyways)

  return (
    <CollapsePanel
      items={numOfIncidents}
      collapseCount={COLLAPSE_COUNT}
      disableBorder={false}
      buttonTitle={tn('Hidden Alert', 'Hidden Alerts', numOfIncidents - COLLAPSE_COUNT)}
    >
      {({isExpanded, showMoreButton}) => (
        <div>
          <StyledPanelTable
            headers={[t('Alert'), t('Reason'), t('Duration'), t('Date Triggered')]}
            isEmpty={!numOfIncidents}
            emptyMessage={t('No alerts triggered during this time.')}
            expanded={numOfIncidents <= COLLAPSE_COUNT || isExpanded}
          >
            {filteredIncidents.map((incident, idx) => {
              if (idx >= COLLAPSE_COUNT && !isExpanded) {
                return null;
              }
              return (
                <MetricAlertActivity
                  key={idx}
                  incident={incident}
                  organization={organization}
                />
              );
            })}
          </StyledPanelTable>
          {showMoreButton}
        </div>
      )}
    </CollapsePanel>
  );
}

export default MetricHistory;

const StyledPanelTable = styled(PanelTable)<{expanded: boolean; isEmpty: boolean}>`
  grid-template-columns: max-content 1fr repeat(2, max-content);

  & > div {
    padding: ${space(1)} ${space(2)};
  }

  div:last-of-type {
    padding: ${p => p.isEmpty && `48px ${space(1)}`};
  }

  ${p =>
    !p.expanded &&
    css`
      margin-bottom: 0px;
      border-bottom-left-radius: 0px;
      border-bottom-right-radius: 0px;
      border-bottom: none;
    `}
`;
