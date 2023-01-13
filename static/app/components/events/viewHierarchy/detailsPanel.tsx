import styled from '@emotion/styled';
import omit from 'lodash/omit';

import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import KeyValueList from '../interfaces/keyValueList';

import type {ViewHierarchyWindow} from '.';

type DetailsPanelProps = {
  data: ViewHierarchyWindow;
  getTitle?: (data: ViewHierarchyWindow) => string;
};

function DetailsPanel({data, getTitle}: DetailsPanelProps) {
  const keyValueData = Object.entries(omit(data, 'id', 'children')).map(
    ([key, value]) => ({
      key,
      value,
      subject: key,
    })
  );

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
  margin-top: ${space(1)};
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};
  padding-bottom: 0;
  max-height: 400px;
  overflow: auto;
`;
