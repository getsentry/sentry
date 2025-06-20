import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: ReplayRecord | undefined;
};

export default function ReplayFlows({replayRecord}: Props) {
  // Get navigation breadcrumbs from the replay record
  let navigationBreadcrumbs =
    replayRecord?.breadcrumbs?.filter(crumb => crumb.category === 'navigation') ?? [];

  // eslint-disable-next-line no-console
  console.log({replayRecord});

  const hardcodedBreadcrumbs = [
    {
      category: 'navigation',
      timestamp: new Date('2024-03-20T10:00:00Z').getTime(),
      data: {
        to: 'https://example.com/home',
        status: 200,
      },
    },
    {
      category: 'navigation',
      timestamp: new Date('2024-03-20T10:01:00Z').getTime(),
      data: {
        to: 'https://example.com/products',
        status: 200,
      },
    },
    {
      category: 'navigation',
      timestamp: new Date('2024-03-20T10:02:00Z').getTime(),
      data: {
        to: 'https://example.com/cart',
        status: 404,
      },
    },
  ];

  navigationBreadcrumbs = hardcodedBreadcrumbs;

  return (
    <Container>
      <BreadcrumbsContainer>
        <Breadcrumbs />
      </BreadcrumbsContainer>
      <StatusContainer>
        <PathStatus>
          <h3>Breadcrumbs Hit</h3>
          <StatusList>
            {navigationBreadcrumbs.map((crumb, index) => (
              <StatusItem key={index}>
                <StatusValue>{crumb.data?.status === 200 ? '✓' : '✗'}</StatusValue>
              </StatusItem>
            ))}
          </StatusList>
        </PathStatus>
      </StatusContainer>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: row;
  height: 100%;
`;

const BreadcrumbsContainer = styled('div')`
  flex: 1;
  overflow: auto;
  border-right: 1px solid ${p => p.theme.border};
`;

const StatusContainer = styled('div')`
  flex: 1;
  padding: 1rem;
`;

const PathStatus = styled('div')`
  background: white;
  border-radius: 4px;
  padding: 1rem;
`;

const StatusList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StatusItem = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StatusValue = styled('span')`
  color: ${p => p.theme.success};
`;
