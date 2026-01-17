import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {space} from 'sentry/styles/space';

type Props = {
  /**
   * The left-hand aligned label
   */
  title: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Display the value with display: flex with a gap
   */
  multiLine?: boolean;
  /**
   * Pass a boolean to render 'yes' or 'no' as the child for true / false
   */
  yesNo?: boolean;
};

/**
 * Detail label is used within DetailList
 */
function DetailLabel({title, yesNo, multiLine, children}: Props) {
  return (
    <Fragment>
      <dt>{title}:</dt>
      <Value multiLine={!!multiLine}>
        {yesNo !== undefined &&
          (yesNo ? <Tag variant="success">yes</Tag> : <Tag variant="danger">no</Tag>)}
        {children}
      </Value>
    </Fragment>
  );
}

const Value = styled('dd')<{multiLine: boolean}>`
  ${p =>
    p.multiLine &&
    css`
      display: flex;
      flex-direction: column;
      gap: ${space(0.5)};
    `};
`;

export default DetailLabel;
