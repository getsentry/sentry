import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import {SectionHeading, Wrapper} from './styles';

type Props = {};

// TODO(releasesV2): waiting for API
const TotalCrashFreeUsers = ({}: Props) => (
  <Wrapper>
    <SectionHeading>{t('Total Crash Free Users')}</SectionHeading>
    <Timeline>
      {[1, 2, 3, 4].map((_, index) => (
        <Row key={index}>
          <InnerRow>
            <Text bold>March 7</Text>
            <Text bold right>
              4.8k users
            </Text>
          </InnerRow>
          <InnerRow>
            <Text>1 wk later</Text>
            <Text right>30%</Text>
          </InnerRow>
        </Row>
      ))}
    </Timeline>
  </Wrapper>
);

const Timeline = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray3};
  line-height: 1;
`;

const DOT_SIZE = 10;
const Row = styled('div')`
  border-left: 1px solid ${p => p.theme.offWhite2};
  padding-left: ${space(2)};
  padding-bottom: ${space(1)};
  margin-left: ${space(1)};
  position: relative;

  &:before {
    content: '';
    width: ${DOT_SIZE}px;
    height: ${DOT_SIZE}px;
    border-radius: 100%;
    background-color: ${p => p.theme.purple};
    position: absolute;
    top: 0;
    left: -${Math.floor(DOT_SIZE / 2)}px;
  }

  &:last-child {
    border-left: 0;
  }
`;
const InnerRow = styled('div')`
  display: grid;
  grid-column-gap: ${space(2)};
  grid-auto-flow: column;
  grid-auto-columns: 1fr;

  padding-bottom: ${space(0.75)};
`;

const Text = styled('div')<{bold?: boolean; right?: boolean}>`
  font-weight: ${p => (p.bold ? 600 : 400)};
  text-align: ${p => (p.right ? 'right' : 'left')};
  ${overflowEllipsis};
`;

export default TotalCrashFreeUsers;
