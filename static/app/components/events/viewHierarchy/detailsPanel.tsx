import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import KeyValueList from '../interfaces/keyValueList';

import {ViewHierarchyWindow} from '.';

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
  margin-bottom: ${space(1)};
  font-weight: bold;
`;

const Container = styled('div')`
  padding: ${space(1.5)};
  padding-bottom: 0;
`;
