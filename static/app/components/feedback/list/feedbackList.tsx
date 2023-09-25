import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import useFeedbackListQueryParams from 'sentry/components/feedback/useFeedbackListQueryParams';
import useFetchFeedbackList from 'sentry/components/feedback/useFetchFeedbackList';
import PanelItem from 'sentry/components/panels/panelItem';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackList(props: Props) {
  const location = useLocation();
  const query = useFeedbackListQueryParams({
    location,
    queryReferrer: 'feedback_list_page',
  });
  const {isLoading, isError, data, pageLinks: _} = useFetchFeedbackList({query}, {});

  return (
    <FeedbackListContainer {...props}>
      <HeaderPanelItem>fixed header</HeaderPanelItem>
      <OverflowPanelItem>
        <ul>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
          <li>feedback item</li>
        </ul>
      </OverflowPanelItem>
    </FeedbackListContainer>
  );
}

const FeedbackListContainer = styled(FluidHeight)`
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
  gap: ${space(3)};
`;
