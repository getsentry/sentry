import {CSSProperties, Fragment} from 'react';
import styled from '@emotion/styled';

import FeedbackErrorDetails from 'sentry/components/feedback/details/feedbackErrorDetails';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import useFeedbackListQueryParams from 'sentry/components/feedback/useFeedbackListQueryParams';
import useFetchFeedbackList from 'sentry/components/feedback/useFetchFeedbackList';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackListLoader(props: Props) {
  const location = useLocation();
  const query = useFeedbackListQueryParams({
    location,
    queryReferrer: 'feedback_list_page',
  });
  const {isLoading, isError, data, pageLinks: _} = useFetchFeedbackList({query}, {});

  return (
    <Container {...props}>
      {isLoading || !data ? (
        <Fragment>
          <HeaderPanelItem>fixed header</HeaderPanelItem>
          <OverflowPanelItem>
            <Placeholder height="100%" />
          </OverflowPanelItem>
        </Fragment>
      ) : isError ? (
        <Fragment>
          <HeaderPanelItem>fixed header</HeaderPanelItem>
          <OverflowPanelItem>
            <FeedbackErrorDetails error={t('Unable to load feedback list')} />
          </OverflowPanelItem>
        </Fragment>
      ) : (
        <FeedbackList items={data} />
      )}
    </Container>
  );
}

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const HeaderPanelItem = styled(PanelItem)`
  display: grid;
  padding: ${space(1)} ${space(2)};
`;

const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;

  flex-direction: column;
  gap: ${space(1)};
`;
