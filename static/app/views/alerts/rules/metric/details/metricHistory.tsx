import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import CollapsePanel from 'sentry/components/collapsePanel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ActivationTriggerActivity, AlertRuleActivation} from 'sentry/types/alerts';
// import {ActivationTrigger} from 'sentry/types/alerts';
import useOrganization from 'sentry/utils/useOrganization';
import MetricAlertActivity from 'sentry/views/alerts/rules/metric/details/metricActivity';
import MetricHistoryActivation from 'sentry/views/alerts/rules/metric/details/metricHistoryActivation';
import type {Incident} from 'sentry/views/alerts/types';

const COLLAPSE_COUNT = 3;

type Props = {
  activations?: AlertRuleActivation[];
  incidents?: Incident[];
};

function MetricHistory({incidents}: Props) {
  const organization = useOrganization();
  const sortedActivity = useMemo(() => {
    const filteredIncidents = (incidents ?? []).filter(
      incident => incident.activities?.length
    );
    const activationTriggers: ActivationTriggerActivity[] = [];
    // NOTE: disabling start/finish trigger rows for now until we've determined whether its
    // valuable during EA

    // activations?.forEach(activation => {
    //   activationTriggers.push({
    //     type: ActivationTrigger.ACTIVATED,
    //     activator: activation.activator,
    //     conditionType: activation.conditionType,
    //     dateCreated: activation.dateCreated,
    //   });
    //   if (activation.isComplete) {
    //     activationTriggers.push({
    //       type: ActivationTrigger.FINISHED,
    //       activator: activation.activator,
    //       conditionType: activation.conditionType,
    //       dateCreated: activation.finishedAt,
    //     });
    //   }
    // });

    return [...filteredIncidents, ...activationTriggers].sort((a, b) =>
      a.dateCreated > b.dateCreated ? -1 : 1
    );
  }, [incidents]);

  const numOfActivities = sortedActivity.length;

  return (
    <CollapsePanel
      items={numOfActivities}
      collapseCount={COLLAPSE_COUNT}
      disableBorder={false}
      buttonTitle={tn('Hidden Alert', 'Hidden Alerts', numOfActivities - COLLAPSE_COUNT)}
    >
      {({isExpanded, showMoreButton}) => (
        <div>
          <StyledPanelTable
            headers={[t('Alert'), t('Reason'), t('Duration'), t('Date Triggered')]}
            isEmpty={!numOfActivities}
            emptyMessage={t('No alerts triggered during this time.')}
            expanded={numOfActivities <= COLLAPSE_COUNT || isExpanded}
            data-test-id={'history-table'}
          >
            {sortedActivity.map((item, idx) => {
              if (idx >= COLLAPSE_COUNT && !isExpanded) {
                return null;
              }
              if ('activator' in item) {
                return (
                  <MetricHistoryActivation
                    key={`${item.type}-${item.activator}`}
                    activationActivity={item}
                    organization={organization}
                  />
                );
              }

              return (
                <MetricAlertActivity
                  key={idx}
                  incident={item}
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
