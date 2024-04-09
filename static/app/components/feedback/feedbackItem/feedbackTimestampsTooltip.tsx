import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import AutoSelectText from 'sentry/components/autoSelectText';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

type Props = {
  feedbackItem: FeedbackIssue;
};

export default function FeedbackTimestampsTooltip({feedbackItem}: Props) {
  const user = ConfigStore.get('user');
  const options = user?.options ?? {};
  const format = options.clock24Hours ? 'HH:mm:ss z' : 'LTS z';
  const dateFirstSeen = feedbackItem.firstSeen ? moment(feedbackItem.firstSeen) : null;
  const resolvedActivity = feedbackItem.activity.find(
    activity => activity.type === 'set_resolved'
  );
  const dateResolved = resolvedActivity ? moment(resolvedActivity.dateCreated) : null;

  return (
    <DescriptionList>
      <dt>{t('Created')}</dt>
      <dd>
        {dateFirstSeen ? (
          <AutoSelectText>
            {dateFirstSeen.format('ll')} {dateFirstSeen.format(format)}
          </AutoSelectText>
        ) : (
          <NotApplicableText>{t('n/a')}</NotApplicableText>
        )}
      </dd>
      {dateResolved && (
        <Fragment>
          <dt>{t('Resolved')}</dt>
          <dd>
            <AutoSelectText>
              {dateResolved.format('ll')} {dateResolved.format(format)}
            </AutoSelectText>
          </dd>
        </Fragment>
      )}
    </DescriptionList>
  );
}

const DescriptionList = styled('dl')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.75)} ${space(1)};
  text-align: left;
  margin: 0;
  white-space: nowrap;
`;

const NotApplicableText = styled('span')`
  color: ${p => p.theme.subText};
`;
