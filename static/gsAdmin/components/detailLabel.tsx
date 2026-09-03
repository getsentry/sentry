import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';

type Props = {
  /**
   * The left-hand aligned label
   */
  title: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Pass a boolean to render 'yes' or 'no' as the child for true / false
   */
  yesNo?: boolean;
};

/**
 * Detail label is used within DetailList
 */
export function DetailLabel({title, yesNo, children}: Props) {
  return (
    <Fragment>
      <dt>{title}:</dt>
      <dd>
        {yesNo !== undefined &&
          (yesNo ? <Tag variant="success">yes</Tag> : <Tag variant="danger">no</Tag>)}
        {children}
      </dd>
    </Fragment>
  );
}
