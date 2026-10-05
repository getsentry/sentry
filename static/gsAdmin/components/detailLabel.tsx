import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {DescriptionList} from '@sentry/scraps/descriptionList';

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
      <DescriptionList.Term>{title}:</DescriptionList.Term>
      <DescriptionList.Details>
        {yesNo !== undefined &&
          (yesNo ? <Tag variant="success">yes</Tag> : <Tag variant="danger">no</Tag>)}
        {children}
      </DescriptionList.Details>
    </Fragment>
  );
}
