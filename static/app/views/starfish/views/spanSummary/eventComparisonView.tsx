import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useQuery} from 'sentry/utils/queryClient';

type Props = {
  clearLeft: () => void;
  clearRight: () => void;
  left?: string;
  right?: string;
};

export function EventComparisonView({left, right, clearLeft, clearRight}: Props) {
  const {isLoading: _isLoadingLeft, data: leftData} = useQuery({
    queryKey: [left],
    queryFn: () =>
      left &&
      fetch(`/api/0/organizations/sentry/events/sentry:${left}/`).then(res => res.json()),
    retry: false,
    initialData: {},
  });
  const {isLoading: _isLoadingRight, data: rightData} = useQuery({
    queryKey: [right],
    queryFn: () =>
      right &&
      fetch(`/api/0/organizations/sentry/events/sentry:${right}/`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: {},
  });

  return (
    <ComparisonContainer>
      <EventContainer>
        <EventHeader>
          <Button
            aria-label={t('Close left event preview.')}
            priority="link"
            onClick={clearLeft}
            icon={<IconClose size="sm" />}
          />
        </EventHeader>
        <EventContentContainer>
          <pre>{JSON.stringify(leftData, null, 4)}</pre>
        </EventContentContainer>
      </EventContainer>
      <EventContainer>
        <EventHeader>
          <Button
            aria-label={t('Close right event preview.')}
            priority="link"
            onClick={clearRight}
            icon={<IconClose size="sm" />}
          />
        </EventHeader>
        <EventContentContainer>
          <pre>{JSON.stringify(rightData, null, 4)}</pre>
        </EventContentContainer>
      </EventContainer>
    </ComparisonContainer>
  );
}

const ComparisonContainer = styled('div')`
  display: flex;
  flex-direction: row;
  margin-bottom: ${space(2)};
  gap: ${space(2)};
`;

const EventContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const EventContentContainer = styled('div')`
  overflow: auto;
  max-height: 500px;
  border: 1px solid ${p => p.theme.border};
`;

const EventHeader = styled('div')`
  text-align: right;
`;
