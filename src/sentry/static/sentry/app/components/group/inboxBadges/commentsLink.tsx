import React from 'react';

import Tag from 'app/components/tag';
import {IconChat} from 'app/icons';
import {SubscriptionDetails} from 'app/types';

/**
 * Used in new inbox
 * Renders the comments link for the group
 */

type Props = {
  to: string;
  subscriptionDetails: SubscriptionDetails | null;
  numComments: number;
};

const CommentsLink = ({to, subscriptionDetails, numComments}: Props) => (
  <Tag
    to={to}
    icon={
      <IconChat
        size="xs"
        color={subscriptionDetails?.reason === 'mentioned' ? 'green300' : undefined}
      />
    }
  >
    {numComments}
  </Tag>
);

export default CommentsLink;
