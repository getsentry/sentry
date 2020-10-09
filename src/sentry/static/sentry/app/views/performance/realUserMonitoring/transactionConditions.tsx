import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Link from 'app/components/links/link';
import {Panel} from 'app/components/panels';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import TagsQuery from 'app/utils/discover/tagsQuery';
import {getShortEventId} from 'app/utils/events';
import {formatPercentage, getDuration} from 'app/utils/formatters';
import BaselineQuery from 'app/views/performance/transactionSummary/baselineQuery';

import {CONDITION_DETAILS} from './constants';
import {Condition} from './types';
import {Card, CardSummary, CardSectionHeading, StatNumber, Description} from './styles';

type Props = {
  organization: Organization;
  location: Location;
  eventView: EventView;
};

class TransactionConditions extends React.Component<Props> {
  renderBaseline() {
    const {eventView, organization} = this.props;
    return (
      <BaselineQuery eventView={eventView} orgSlug={organization.slug}>
        {({results}) => {
          const duration = results?.['transaction.duration'];
          return (
            <CardSummary>
              <CardSectionHeading>{t('Baseline Duration')}</CardSectionHeading>
              <StatNumber>
                {duration ? getDuration(duration / 1000, 2) : '\u2014'}
              </StatNumber>
              {results?.id && (
                <Link to="#">
                  <Description>ID: {getShortEventId(results.id)}</Description>
                </Link>
              )}
            </CardSummary>
          );
        }}
      </BaselineQuery>
    );
  }

  renderConditions() {
    const {eventView, location, organization} = this.props;
    return (
      <TagsQuery
        eventView={eventView}
        location={location}
        orgSlug={organization.slug}
        tags={Object.values(Condition).map(condition => CONDITION_DETAILS[condition].tag)}
      >
        {results => {
          return (
            <Conditions>
              {Object.values(Condition).map(condition => {
                const {icon, label, description, tag} = CONDITION_DETAILS[condition];

                const data = results.tableData ?? [];
                const index = data.findIndex(tagDetail => tagDetail.key === tag);
                const values = data[index]?.topValues;
                const hasResults = index > -1 && values.length;

                return (
                  <ConditionItem key={condition}>
                    <ConditionIcon>{icon}</ConditionIcon>
                    <ConditionDescription>
                      <div>{label}</div>
                      <div>
                        {hasResults && (
                          <Link to="#">
                            {tct(description, {
                              percentage: formatPercentage(
                                values[0].count /
                                  values.reduce((total, value) => total + value.count, 0),
                                0
                              ),
                              value: values[0].value,
                            })}
                          </Link>
                        )}
                        {!hasResults && '\u2014'}
                      </div>
                    </ConditionDescription>
                  </ConditionItem>
                );
              })}
            </Conditions>
          );
        }}
      </TagsQuery>
    );
  }

  render() {
    return (
      <Panel>
        <Card>
          {this.renderBaseline()}
          {this.renderConditions()}
        </Card>
      </Panel>
    );
  }
}

// type TagProps = {
//   icon: React.ReactNode;
//   heading: string;
//   details: string;
// };
//
// class TransactionTag extends React.Component<TagProps> {
//   render() {
//     const {icon, heading, details} = this.props;
//
//     return (
//       <SummaryItem>
//         <SummaryIcon>{icon}</SummaryIcon>
//         <SummaryDescription>
//           <div>{heading}</div>
//           <div>{details}</div>
//         </SummaryDescription>
//       </SummaryItem>
//     );
//   }
// }

const Conditions = styled('div')`
  display: grid;
  align-content: start;
  grid-template-columns: 1fr 1fr 1fr;
`;

const ConditionItem = styled('div')`
  display: grid;
  grid-template-columns: 20px auto;
  padding: ${space(3)} ${space(4)};
  font-size: 14px;
`;

const ConditionIcon = styled('div')`
  justify-self: center;
  padding: ${space(0.25)};
`;

const ConditionDescription = styled('div')`
  padding-left: ${space(1.5)};
`;

export default TransactionConditions;
