import styled from '@emotion/styled';
import moment from 'moment-timezone';

import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import {IconBusiness} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import ZendeskLink from 'getsentry/components/zendeskLink';
import {ANNUAL} from 'getsentry/constants';
import {CohortId, type PlanMigration, type Subscription} from 'getsentry/types';

import {PanelBodyWithTable} from '../styles';

import PlanMigrationTable from './planMigrationTable';

type Props = {
  migration: undefined | PlanMigration;
  subscription: Subscription;
};

function NewFeature({title}: {title: string}) {
  return (
    <Feature>
      <IconBusiness gradient size="sm" />
      {title}
    </Feature>
  );
}

function getMigrationDate(migration: PlanMigration, subscription: Subscription) {
  if (migration.effectiveAt) {
    return moment(migration.effectiveAt).format('ll');
  }
  if (subscription.billingInterval === ANNUAL) {
    return moment(subscription.onDemandPeriodEnd).add(1, 'days').format('ll');
  }
  return moment(subscription.contractPeriodEnd).add(1, 'days').format('ll');
}

function PlanMigrationActive({subscription, migration}: Props) {
  if (!migration?.cohort?.nextPlan) {
    return null;
  }

  const isAM3Migration = migration.cohort.cohortId >= CohortId.EIGHTH;

  return (
    <Panel data-test-id="plan-migration-panel">
      <StyledPanelBody withPadding>
        <MigrationDetailsWithFooter>
          <MigrationDetails>
            <h4>
              {tct("We're updating our [planName] Plan", {
                planName: subscription.planDetails.name,
              })}
            </h4>
            <p>
              {tct('These plan changes will take place on [date].', {
                date: getMigrationDate(migration, subscription),
              })}
            </p>
            <div>
              <h6>{t('New Features:')}</h6>
              {isAM3Migration ? (
                <p>
                  <NewFeature
                    key="performance"
                    title={t('10M spans for easier debugging and performance monitoring')}
                  />
                  <NewFeature
                    key="payg"
                    title={t('Simplified, cheaper pay-as-you-go pricing')}
                  />
                  <NewFeature key="and-more" title={t('And more...')} />
                </p>
              ) : (
                <p>
                  <NewFeature key="performance" title={t('Performance Monitoring')} />
                  <NewFeature key="attachments" title={t('Event Attachments')} />
                  <NewFeature
                    key="stack-trace-linking"
                    title={t('Stack Trace Linking')}
                  />
                  <NewFeature key="and-more" title={t('And more...')} />
                </p>
              )}
            </div>
          </MigrationDetails>

          <MoreInfo>
            {tct(
              'For more details please see our [faqLink:FAQ] or contact [zendeskLink:Support].',
              {
                faqLink: (
                  <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/29172070122651-How-is-my-legacy-plan-changing-September-12-2024" />
                ),
                zendeskLink: (
                  <ZendeskLink
                    subject="Legacy Plan Migration Question"
                    source="billing"
                  />
                ),
              }
            )}
          </MoreInfo>
        </MigrationDetailsWithFooter>
        <PlanMigrationTable subscription={subscription} migration={migration} />
      </StyledPanelBody>
    </Panel>
  );
}

export default PlanMigrationActive;

const StyledPanelBody = styled(PanelBodyWithTable)`
  h6 {
    font-weight: 400;
    font-size: ${p => p.theme.fontSizeLarge};
    margin-bottom: ${space(0.75)};
  }

  table {
    margin-bottom: ${space(1)};
  }

  p,
  h4 {
    margin: 0;
  }
`;

const MigrationDetailsWithFooter = styled('div')`
  display: grid;
  grid-auto-flow: row;
  align-content: space-between;
`;

const MigrationDetails = styled('div')`
  display: grid;
  gap: ${space(3)};
`;

const Feature = styled('span')`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1)};
  align-items: center;
  align-content: center;
`;

const MoreInfo = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
`;
