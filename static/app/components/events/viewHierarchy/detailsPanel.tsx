import styled from '@emotion/styled';
import omit from 'lodash/omit';

import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {defined} from 'sentry/utils';

import type {ViewHierarchyWindow} from '.';

type DetailsPanelProps = {
  data: ViewHierarchyWindow;
  getTitle?: (data: ViewHierarchyWindow) => string;
};

function DetailsPanel({data, getTitle}: DetailsPanelProps) {
  const keyValueData = Object.entries(omit(data, 'children')).map(([key, value]) => ({
    key,
    value,
    subject: key,
  }));

  return (
    <Container>
      {defined(getTitle) && <Title>{getTitle(data)}</Title>}
      <KeyValueList data={keyValueData} />
    </Container>
  );
}

export {DetailsPanel};

const Title = styled('header')`
  margin-bottom: ${p => p.theme.space.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const Container = styled('div')`
  padding: ${p => p.theme.space.lg};
  padding-bottom: 0;
`;
