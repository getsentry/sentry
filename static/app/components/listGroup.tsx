import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type ListGroupItemProps = {
  centered?: boolean;
};

const ListGroupItem = styled('li')<ListGroupItemProps>`
  position: relative;
  display: block;
  min-height: 36px;
  border: 1px solid ${p => p.theme.border};

  padding: ${space(0.5)} ${space(1.5)};

  margin-bottom: -1px;
  ${p => (p.centered ? 'text-align: center;' : '')}

  &:first-child {
    border-top-left-radius: ${p => p.theme.borderRadius};
    border-top-right-radius: ${p => p.theme.borderRadius};
  }
  &:last-child {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
`;

export {ListGroupItem};
