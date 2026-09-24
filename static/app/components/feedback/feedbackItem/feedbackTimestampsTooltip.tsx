import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Tooltip} from '@sentry/scraps/tooltip';

import {AutoSelectText} from 'sentry/components/autoSelectText';
import {t} from 'sentry/locale';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {useUser} from 'sentry/utils/useUser';

type Props = {
  feedbackItem: FeedbackIssue;
};

export function FeedbackTimestampsTooltip({feedbackItem}: Props) {
  const user = useUser();
  const options = user?.options ?? {};
  const format = options.clock24Hours ? 'HH:mm:ss z' : 'LTS z';
  const dateFirstSeen = feedbackItem.firstSeen ? moment(feedbackItem.firstSeen) : null;
  const resolvedActivity = feedbackItem.activity.find(
    activity => activity.type === 'set_resolved'
  );
  const dateResolved = resolvedActivity ? moment(resolvedActivity.dateCreated) : null;

  return (
    <Tooltip.Grid dl nowrap>
      <DescriptionList.Term>{t('Created')}</DescriptionList.Term>
      <DescriptionList.Details>
        {dateFirstSeen ? (
          <AutoSelectText>
            {dateFirstSeen.format('ll')} {dateFirstSeen.format(format)}
          </AutoSelectText>
        ) : (
          <NotApplicableText>{t('n/a')}</NotApplicableText>
        )}
      </DescriptionList.Details>
      {dateResolved && (
        <Fragment>
          <DescriptionList.Term>{t('Resolved')}</DescriptionList.Term>
          <DescriptionList.Details>
            <AutoSelectText>
              {dateResolved.format('ll')} {dateResolved.format(format)}
            </AutoSelectText>
          </DescriptionList.Details>
        </Fragment>
      )}
    </Tooltip.Grid>
  );
}

const NotApplicableText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
